const jwt = require('jsonwebtoken');
const logger = require('../loggerWinston');

const login = (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.AUTH_USER && password === process.env.AUTH_PASS) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        logger.info(`Usuario ${username} ha iniciado sesión.`);
        res.send({ token });
    } else {
        logger.error('Credenciales incorrectas.');
        res.status(401).send({ error: 'Credenciales incorrectas.' });
    }
};

module.exports = { login };
