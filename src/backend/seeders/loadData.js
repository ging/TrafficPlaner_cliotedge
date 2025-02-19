const { marshall } = require('@aws-sdk/util-dynamodb'); 
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');
const ion = require('ion-js');
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

// Ruta donde están los archivos
const dataPath = path.join(__dirname, '../datos/');
const detectionsPath = path.join(dataPath, 'Detecciones De Vehiculos/');

// Verificar si una ruta es un archivo
const isFile = (filePath) => fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();

// Función para leer archivos `.json`
const readJsonFile = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            if (!isFile(filePath)) return reject(`El archivo no existe o es un directorio: ${filePath}`);

            const data = fs.readFileSync(filePath, 'utf8');
            let jsonData = JSON.parse(data);
            if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].Item) {
                jsonData = jsonData.map(entry => entry.Item);
            }

            resolve(jsonData);
        } catch (error) {
            reject(`Error al parsear JSON en ${filePath}: ${error.message}`);
        }
    });
};


// Función para leer archivos `.ion`
const readIonFile = (filePath) => {
    return new Promise((resolve, reject) => {
        if (!isFile(filePath)) return reject(`El archivo no existe o es un directorio: ${filePath}`);

        fs.readFile(filePath, (err, data) => {
            if (err) return reject(`Error al leer el archivo ${filePath}: ${err.message}`);
            try {
                const ionData = ion.loadAll(data);
                let jsonData = JSON.parse(JSON.stringify(ionData));

                if (!Array.isArray(jsonData)) {
                    jsonData = [jsonData]; 
                }

                jsonData = jsonData.map(entry => entry.Item || entry);

                resolve(jsonData);
            } catch (e) {
                reject(`Error al parsear ION en ${filePath}: ${e.message}`);
            }
        });
    });
};



const insertData = async (tableName, items) => {
    if (!Array.isArray(items) || items.length === 0) {
        logger.error(`Error: No hay datos válidos para insertar en ${tableName}.`);
        return;
    }

    for (const item of items) {
        try {
            logger.info(`Intentando insertar en ${tableName}:`, item);

            // Convertir el item a formato DynamoDB, excepto para la tabla "Cameras"
            const params = {
                TableName: tableName,
                Item: tableName === "Cameras" ? item : marshall(item), 
            };

            await dynamoDB.send(new PutItemCommand(params));
            logger.info(`Insertado en ${tableName}:`, params.Item);
        } catch (error) {
            logger.error(`Error insertando en ${tableName}:`, error.message);
        }
    }
};



const readAllIonFiles = async (folderPath) => {
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.ion'));
    let allData = [];
    for (const file of files) {
        try {
            const filePath = path.join(folderPath, file);
            const fileData = await readIonFile(filePath);
            allData = allData.concat(fileData);
        } catch (error) {
            logger.error(`Error procesando ${file}: ${error}`);
        }
    }
    return allData;
};

const loadAllData = async () => {
    try {
        logger.info("Cargando datos en DynamoDB...");

        // Cargar archivos JSON de Cámaras
        const camerasData = await readJsonFile(path.join(dataPath, 'Camaras/hnh6f3fnsa2otkzkoma5qpsjfa.json'));

        // Cargar archivos ION de Detecciones y Vehículos
        const detectionsData = await readAllIonFiles(detectionsPath);
        const vehiclesData = await readIonFile(path.join(dataPath, 'Vehiculos/mtwwxzknuy3fnkqhdfk7v74cr4.ion'));

        const detectionsDataFlat = detectionsData.flat().filter(obj => obj !== undefined);
        const vehiclesDataFlat = vehiclesData.flat().filter(obj => obj !== undefined);

        await insertData('Cameras', camerasData);
        await insertData('Detections', detectionsDataFlat);
        await insertData('Vehicles', vehiclesDataFlat);

        logger.info("¡Carga de datos completada con éxito!");
    } catch (error) {
        logger.error("Error en la carga de datos:", error);
    }
};

// Ejecutar la carga de datos
loadAllData();
