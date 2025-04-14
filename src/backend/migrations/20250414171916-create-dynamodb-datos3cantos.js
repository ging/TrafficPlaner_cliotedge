require('dotenv').config();
console.log('Region:', process.env.DYNAMODB_REGION);
console.log('Endpoint:', process.env.DYNAMODB_ENDPOINT);
console.log('Access Key:', process.env.DYNAMODB_ACCESS_KEY_ID);
console.log('Secret Key:', process.env.DYNAMODB_SECRET_ACCESS_KEY);


const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

// Configurar conexión con DynamoDB 
const dynamoDB = new DynamoDBClient({
  region: process.env.DYNAMODB_REGION,
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
      accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
      secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY
  }
});


// Definir las tablas nuevas

const tables = [
  {
    TableName: 'rt_car_access_by_device',
    KeySchema: [
      { AttributeName: 'camera_id', KeyType: 'HASH' },
      { AttributeName: 'day_observed', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'camera_id', AttributeType: 'S' },
      { AttributeName: 'day_observed', AttributeType: 'N' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'rt_car_access',
    KeySchema: [
      { AttributeName: 'day_observed', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'day_observed', AttributeType: 'N' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'tf_waste_weights',
    KeySchema: [
      { AttributeName: 'uniqueid', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'uniqueid', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'tf_waste_carbon_print',
    KeySchema: [
      { AttributeName: 'uniqueid', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'uniqueid', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'tf_waste_observed_routes',
    KeySchema: [
      { AttributeName: 'uniqueid', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'uniqueid', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }
];

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
