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
node migrations/20250623121150-create-mongo
```

Downnload the data from https://drive.upm.es/s/P5k32snD6QBCq6w (requires password). Data from 1 Nov 2024 to 25 May 2024
Copy the data from dynamo (real database) in src/backend/datos/Datos3Cantos folder:

- rt_car_access_by_device.json
- rt_car_access.json
- carbon_print.json
- observed_routes.json
- tf_waste_weights.json

Upload the data
```	
node seeders/loadDataMongo.js
```	

## To run the test benchmark
Execute from src/pruebas
```
node benchmark.js
```


## Guardarrailes 

Se ha implementado un middleware (railMiddleware.js) donde se permite o no responder a las preguntas del usuario en función del tema sobre el que se está preguntando.

Esto se realiza mediante una llamada al modelo donde se envía la pregunta del usuario y una serie de instrucciones sobre lo que puede responder y lo que no. Como respuesta se recibe un JSON con un booleano que indica si se permite o no responder a la pregunta y una descripción del motivo.