
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { marshall } = require('@aws-sdk/util-dynamodb');
const {
    DynamoDBClient,
    ScanCommand,
    DeleteItemCommand,
    PutItemCommand,
    DescribeTableCommand
} = require('@aws-sdk/client-dynamodb');
const logger = require('../loggerWinston');


const region = process.env.DYNAMODB_REGION || process.env.AWS_REGION;
const endpoint = process.env.DYNAMODB_ENDPOINT;
const accessKeyId = process.env.DYNAMODB_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.DYNAMODB_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (!region || !accessKeyId || !secretAccessKey) {
    logger.error('Faltan credenciales o configuración de AWS/DynamoDB. Revisa tu .env.');
    process.exit(1);
}

const dynamo = new DynamoDBClient({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
});

const dataDir = path.join(__dirname, '../datos/Datos3Cantos');

const TABLE_MAPPING = {
    'carbon_print.json': 'tf_waste_carbon_print',
    'observed_routes.json': 'tf_waste_observed_routes',
    'rt_car_access_by_device.json': 'rt_car_access_by_device',
    'rt_car_access.json': 'rt_car_access',
    'tf_waste_weights.json': 'tf_waste_weights'
};

// Bandeja de entrada CLI → --truncate / -t borra registros antes de insertar
const TRUNCATE = process.argv.includes('--truncate') || process.argv.includes('-t');


async function getKeyFields(tableName) {
    const desc = await dynamo.send(new DescribeTableCommand({ TableName: tableName }));
    return (desc.Table.KeySchema || []).map(k => k.AttributeName);
}

async function clearTable(tableName, keyFields) {
    let lastKey;
    do {
        const res = await dynamo.send(
            new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastKey,
                ProjectionExpression: keyFields.join(',')
            })
        );

        for (const it of res.Items ?? []) {
            const Key = {};
            keyFields.forEach(f => (Key[f] = it[f]));
            await dynamo.send(new DeleteItemCommand({ TableName: tableName, Key }));
            logger.info(`[${tableName}] eliminado:`, Key);
        }
        lastKey = res.LastEvaluatedKey;
    } while (lastKey);
}

async function insertAll(tableName, items) {
    for (const item of items) {
        await dynamo.send(new PutItemCommand({ TableName: tableName, Item: marshall(item) }));
        logger.info(`[${tableName}] insertado:`, item);
    }
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function processFile(fileName, tableName) {
    const fullPath = path.join(dataDir, fileName);
    if (!fs.existsSync(fullPath)) {
        logger.warn(`Archivo no encontrado: ${fullPath} — se omite.`);
        return;
    }

    logger.info(`\n→ Procesando ${fileName} → tabla ${tableName}`);

    const data = readJson(fullPath);
    if (!Array.isArray(data) || !data.length) {
        logger.warn(`${fileName} no contiene un array JSON válido — se omite.`);
        return;
    }

    if (TRUNCATE) {
        const keyFields = await getKeyFields(tableName);
        logger.info(`[${tableName}] Limpiando registros existentes… (${keyFields.join(', ')})`);
        await clearTable(tableName, keyFields);
    }

    await insertAll(tableName, data);
}


async function main() {
    try {
        for (const [fileName, tableName] of Object.entries(TABLE_MAPPING)) {
            await processFile(fileName, tableName);
        }
        logger.info('\n✅  Carga finalizada con éxito');
    } catch (err) {
        logger.error('❌  Error en loadData.js:', err);
        process.exit(1);
    }
}

main();
