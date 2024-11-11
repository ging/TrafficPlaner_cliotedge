const jwt = require('jsonwebtoken');
const logger = require('../loggerWinston');

const authMiddleware = (req, res, next) => {
    if (process.env.AUTHENTICATION === 'false') {
        // Si AUTHENTICATION está en false, omitimos la autenticación
        logger.info('Autenticación deshabilitada.');
        return next();
    }

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        logger.error('Token de autenticación no proporcionado.');
        return res.status(401).send({ error: 'Token de autenticación no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        logger.info('Token válido.');
        next();
    } catch (error) {
        logger.error('Token no válido.');
        res.status(401).send({ error: 'Token no válido.' });
    }
};

module.exports = authMiddleware;
