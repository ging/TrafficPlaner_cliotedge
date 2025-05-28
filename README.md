# CLIoTEDGE LLM API

![version](https://img.shields.io/badge/node-v20.15.0-green)
![version](https://img.shields.io/badge/PostgreSQL-v17.0-blue)



## Deployment 

Install the services listed in docker-compose.yml
```
cd src
npm install
npm start
````

With Docker:
```
docker compose up --build
```

Open http://localhost:3002 and start asking...


## To import the data to the database

Execute the migration from src/backend
```
node migrations/20250414171916-create-dynamodb-datos3cantos.js
```

Copy the data from dynamo in src/backend/datos folder:

- rt_car_access_by_device.json
- rt_car_access.json
- tf_waste_carbon_print.json
- tf_waste_observed_routes.json
- tf_waste_weights.json

And add in src/backend/datos/data:
- observed_routes.json
- carbon_print.json


Upload the data
```	
node seeders/loadData.js
```	

## To run the test benchmark
Execute from src/pruebas
```
node benchmark.js
```
