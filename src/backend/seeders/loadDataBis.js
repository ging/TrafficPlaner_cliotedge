const fs = require('fs');
const path = require('path');
// Carga variables de entorno desde el .env en la raíz del proyecto
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

// Configuración DynamoDB y validación de credenciales
const region = process.env.DYNAMODB_REGION || process.env.AWS_REGION;
const endpoint = process.env.DYNAMODB_ENDPOINT;
const accessKeyId = process.env.DYNAMODB_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.DYNAMODB_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

logger.info(`Region: ${region}`);
logger.info(`Endpoint: ${endpoint}`);
logger.info(`Access Key: ${accessKeyId}`);
logger.info(`Secret Key: ${secretAccessKey ? '****' : undefined}`);

if (!region || !accessKeyId || !secretAccessKey) {
  logger.error('Faltan credenciales o configuración de AWS/DynamoDB. Revisa tu .env.');
  process.exit(1);
}

// Cliente DynamoDB
const dynamo = new DynamoDBClient({ region, endpoint, credentials: { accessKeyId, secretAccessKey } });

// Obtiene el esquema de claves primarias de la tabla
async function getKeyFields(tableName) {
  const desc = await dynamo.send(new DescribeTableCommand({ TableName: tableName }));
  if (!desc.Table || !desc.Table.KeySchema) {
    throw new Error(`No se pudo obtener KeySchema para ${tableName}`);
  }
  return desc.Table.KeySchema.map(k => k.AttributeName);
}

// Lee JSON desde disco
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Borra todos los ítems de la tabla usando sus claves primarias
async function clearTable(tableName, keyFields) {
  let lastKey;
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey,
      ProjectionExpression: keyFields.join(',')
    }));

    if (res.Items && res.Items.length) {
      for (const it of res.Items) {
        const Key = {};
        keyFields.forEach(f => { Key[f] = it[f]; });
        await dynamo.send(new DeleteItemCommand({ TableName: tableName, Key }));
        logger.info(`Borrado de ${tableName}:`, Key);
      }
    }

    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
}

// Inserta datos en la tabla
async function insertAll(tableName, data) {
  for (const item of data) {
    await dynamo.send(new PutItemCommand({ TableName: tableName, Item: marshall(item) }));
    logger.info(`Insertado en ${tableName}:`, item);
  }
}

// Flujo principal
async function main() {
  try {
    const dataDir = path.join(__dirname, '../datos/data');
    const tables = [
      { name: 'tf_waste_carbon_print',    file: 'carbon_print.json' },
      { name: 'tf_waste_observed_routes', file: 'observed_routes.json' }
    ];

    for (const { name, file } of tables) {
      const fullPath = path.join(dataDir, file);
      logger.info(`\n→ Actualizando tabla ${name}`);

      // Obtiene dinámicamente las claves primarias
      const keyFields = await getKeyFields(name);
      logger.info(`Claves primarias de ${name}: ${keyFields.join(', ')}`);

      const data = readJson(fullPath);
      await clearTable(name, keyFields);
      await insertAll(name, data);
    }

    logger.info('\n¡Tablas tf_waste_carbon_print y tf_waste_observed_routes actualizadas correctamente!');
  } catch (e) {
    logger.error('Error en loadDataBis.js:', e);
    process.exit(1);
  }
}

main();
