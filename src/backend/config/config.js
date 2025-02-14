const process = require('process');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const dynamoDB = new DynamoDBClient({
    region: 'eu-south-2',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://dynamodb-local:8000',
    credentials: {
        accessKeyId: 'fakeMyKeyId',
        secretAccessKey: 'fakeMySecretKey'
    }
});

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
