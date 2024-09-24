const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config({ path: './.env' });

const apiRouter = require('./routes/api');
const threadRouter = require('./routes/thread');

const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Ruta de la petición a la API
app.use('/api', apiRouter);

// Rutas para las threads
app.use('/threads', threadRouter);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
