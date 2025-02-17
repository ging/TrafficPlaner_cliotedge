# CLIoTEDGE LLM API

![version](https://img.shields.io/badge/node-v20.15.0-green)
![version](https://img.shields.io/badge/PostgreSQL-v17.0-blue)



## Deployment 
<!-- npm install
cd src
node app.js -->
```
npm install
docker compose up --build
```

Open index.html and start asking...


## To import the data to the database

Execute the migration
```
node src/backend/migrations/20250204101831-create-dynamodb-tables.js
```

Upload the data
```	
node src/backend/seeders/loadData.js
```	

