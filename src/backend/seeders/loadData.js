require('dotenv').config();
console.log('Region:', process.env.DYNAMODB_REGION);
console.log('Endpoint:', process.env.DYNAMODB_ENDPOINT);
console.log('Access Key:', process.env.DYNAMODB_ACCESS_KEY_ID);
console.log('Secret Key:', process.env.DYNAMODB_SECRET_ACCESS_KEY);


const { marshall } = require('@aws-sdk/util-dynamodb');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');
const logger = require('../loggerWinston');  

// Configurar conexión con DynamoDB Local
const dynamoDB = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
        accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
        secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY
    }
});

// Función para leer un archivo JSON
const readJsonFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject(`Error al leer el archivo ${filePath}: ${err.message}`);
            }
            try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
            } catch (e) {
                reject(`Error al parsear JSON en ${filePath}: ${e.message}`);
            }
        });
    });
};

// Función para insertar datos en una tabla
const insertData = async (tableName, items) => {
    if (!Array.isArray(items) || items.length === 0) {
        logger.error(`Error: No hay datos válidos para insertar en ${tableName}.`);
        return;
    }

    for (const item of items) {
        try {
            const params = {
                TableName: tableName,
                Item: marshall(item)
            };

            await dynamoDB.send(new PutItemCommand(params));
            logger.info(`Insertado en ${tableName}:`, params.Item);
        } catch (error) {
            logger.error(`Error insertando en ${tableName}: ${error.message}`);
        }
    }
};

// Función principal para cargar todos los datos
const loadAllData = async () => {
    try {
        logger.info("Cargando datos en DynamoDB...");

        // Directorio donde se encuentran tus archivos JSON
        const dataDir = path.join(__dirname, '../datos');

        // Mapeo de tabla a archivo JSON 
        const filesMapping = {
            rt_car_access_by_device: 'rt_car_access_by_device.json',
            rt_car_access: 'rt_car_access.json',
            tf_waste_weights: 'tf_waste_weights.json',
            tf_waste_carbon_print: 'tf_waste_carbon_print.json',
            tf_waste_observed_routes: 'tf_waste_observed_routes.json'
        };

        // Leer cada archivo e insertar los datos en la tabla correspondiente
        for (const [tableName, fileName] of Object.entries(filesMapping)) {
            const filePath = path.join(dataDir, fileName);
            logger.info(`Leyendo datos del archivo ${filePath} para la tabla ${tableName}...`);
            try {
                const data = await readJsonFile(filePath);
                await insertData(tableName, data);
            } catch (error) {
                logger.error(`Error procesando el archivo ${filePath}: ${error}`);
            }
        }

        logger.info("¡Carga de datos completada con éxito!");
    } catch (error) {
        logger.error("Error en la carga de datos:", error);
    }
};

// Ejecutar la carga de datos
loadAllData();
