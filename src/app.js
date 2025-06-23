const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');


const bodyParser = require('body-parser');
require('dotenv').config({ path: './backend/.env' });

const { sequelize } = require('./backend/models');
const logger = require('./backend/loggerWinston');

const apiRouter = require('./backend/routes/api');
const threadRouter = require('./backend/routes/thread');

const CONTEXT = process.env.CONTEXT || '';

console.log(path.join('/', CONTEXT, 'api'));

const app = express();
const port = 3002;


// Habilitar CORS para todas las rutas
app.use(cors());

app.use(morgan('combined', {
    stream: {
        write: (message) => {
            if (message.includes(' 4') || message.includes(' 5')) {
                logger.error(message.trim()); // Log de errores HTTP
            } else {
                logger.info(message.trim()); // Log de otras solicitudes HTTP
            }
        }
    }
}));


app.use(express.json())

// Middleware para parsear JSON
app.use(bodyParser.json());


// Configuración para el frontend con EJS 

// Configurar EJS y la carpeta de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend'));

// Servir archivos estáticos (para archivos como chatbot.js, style.css)
app.use(express.static(path.join(__dirname, 'frontend')));

// Ruta para renderizar la vista principal (index.ejs)
app.get('/', (req, res) => {
    res.render('index', {
        apiUrl: process.env.API_URL || 'http://localhost:3002',
        context: process.env.CONTEXT || ''
    });
});

// Ruta de la petición a la API
app.use(path.join('/', CONTEXT, 'api'), apiRouter);

// Rutas para las threads
app.use(path.join('/',CONTEXT, 'threads'), threadRouter);




// Sincroniza la base de datos y configura el servidor
sequelize.sync()
    .then(() => {
        logger.info('Conectado a la base de datos');
        // Iniciar el servidor solo después de la conexión a la base de datos
        app.listen(port, () => {
            logger.info(`CONTEXT: ${CONTEXT}`);
            const url = CONTEXT ? `${path.join('http://localhost:' + port)}` : `http://localhost:${port}`;
            logger.info(`Servidor escuchando en ${url}`);
        });
    })
    .catch(err => {
        logger.error('Error conectando a la base de datos:', err);
    });