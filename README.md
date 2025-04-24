# CLIoTEDGE LLM API

![version](https://img.shields.io/badge/node-v20.15.0-green)
![version](https://img.shields.io/badge/PostgreSQL-v17.0-blue)



## Deployment 
<!-- npm install
cd src
node app.js -->
```
cd src
npm install
cd ..
docker compose up --build
```

Open http://localhost:3002 and start asking...


## To import the data to the database

Execute the migration from src/backend
```
node migrations/20250414171916-create-dynamodb-datos3cantos.js
```

Upload the data
```	
node seeders/loadData.js
```	

## To run the test benchmark
Execute from src/pruebas
```
node benchmark.js
```
