const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        // Todos los logs a partir del nivel 'error' se escriben en el archivo error.log 
        new winston.transports.File({ filename: 'error.log', level: 'error' }),

        // Todos los logs a partir del nivel 'info' se escriben en el archivo error.log 
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

module.exports = logger;
