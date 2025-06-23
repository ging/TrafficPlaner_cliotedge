const path = require('path');
const process = require('process');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});


const dynamoDB = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
        accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
        secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY
    }
});


require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

const mongoose = require('mongoose');

const user = process.env.MONGO_INITDB_ROOT_USERNAME;
const pass = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
const host = process.env.MONGO_HOST;
const port = process.env.MONGO_PORT;
const db   = process.env.MONGO_INITDB_DATABASE;

const uri = `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin`;

console.log('→ Connecting to MongoDB at', uri);
mongoose.connect(uri)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

module.exports = mongoose;


module.exports = {
    dynamoDB,
    "development": {
        "username": process.env.POSTGRES_USER,
        "password": process.env.POSTGRES_PASSWORD,
        "database": process.env.POSTGRES_DB,
        "host": process.env.DB_HOST,
        "dialect": "postgres"
    },
    "test": {
        "username": "root",
        "password": null,
        "database": "database_test",
        "host": "127.0.0.1",
        "dialect": "postgres"
    },
    "production": {
        "username": "root",
        "password": null,
        "database": "database_production",
        "host": "127.0.0.1",
        "dialect": "postgres"
    }
};
