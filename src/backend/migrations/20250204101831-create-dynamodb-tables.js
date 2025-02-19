const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

// Configurar conexión con DynamoDB Local
const dynamoDB = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
        accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
        secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY
    }
});

// Definir las tablas
const tables = [
    {
        TableName: 'Cameras',
        KeySchema: [{ AttributeName: 'CameraID', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'CameraID', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
    },
    {
        TableName: 'Detections',
        KeySchema: [{ AttributeName: 'DetectionID', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'DetectionID', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
    },
    {
        TableName: 'Vehicles',
        KeySchema: [{ AttributeName: 'VehicleID', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'VehicleID', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
    }
];

// Crear las tablas 
const createTables = async () => {
    for (const params of tables) {
        try {
            await dynamoDB.send(new CreateTableCommand(params));
            console.log(`Tabla ${params.TableName} creada.`);
        } catch (error) {
            if (error.name === 'ResourceInUseException') {
                console.log(`La tabla ${params.TableName} ya existe.`);
            } else {
                console.error(`Error creando la tabla ${params.TableName}:`, error);
            }
        }
    }
};

createTables();
