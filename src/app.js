const express = require('express');
const cors = require('cors');

const bodyParser = require('body-parser');
require('dotenv').config({ path: './backend/.env' });

const { sequelize } = require('./backend/models');
const logger = require('./backend/loggerWinston');

const apiRouter = require('./backend/routes/api');
const threadRouter = require('./backend/routes/thread');

const app = express();
const port = 3000;

// Habilitar CORS para todas las rutas
app.use(cors());

app.use(express.json())

// Middleware para parsear JSON
app.use(bodyParser.json());

// Ruta de la petición a la API
app.use('/api', apiRouter);

// Rutas para las threads
app.use('/threads', threadRouter);




// Sincroniza la base de datos y configura el servidor
sequelize.sync()
    .then(() => {
        logger.info('Conectado a la base de datos');
        // Iniciar el servidor solo después de la conexión a la base de datos
        app.listen(port, () => {
            logger.info(`Servidor escuchando en http://localhost:${port}`);
        });
    })
    .catch(err => {
        logger.error('Error conectando a la base de datos:', err);
    });