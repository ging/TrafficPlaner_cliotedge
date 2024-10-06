const express = require('express');
const cors = require('cors');

const logger = require('./backend/loggerWinston');

const bodyParser = require('body-parser');
require('dotenv').config({ path: './backend/.env' });

const apiRouter = require('./backend/routes/api');
const threadRouter = require('./backend/routes/thread');

const app = express();
const port = 3000;

// Habilitar CORS para todas las rutas
app.use(cors());

// Middleware para parsear JSON
app.use(bodyParser.json());

// Ruta de la petición a la API
app.use('/api', apiRouter);

// Rutas para las threads
app.use('/threads', threadRouter);

// Iniciar el servidor
app.listen(port, () => {
  logger.info(`Servidor escuchando en http://localhost:${port}`);
});
