const express = require('express');
const controllerThread = require('../controllers/controllerThreadMongoDB');
const authMiddleware = require('../middlewares/authenticationMiddlewares');

const router = express.Router();

const authController = require('../controllers/controllerAuthentication');

// Ruta de login para obtener el token JWT
router.post('/login', authController.login);

// Crear un nuevo thread y asistente
router.post('/create', authMiddleware, controllerThread.createThread);

// Enviar un mensaje en un thread existente
router.post('/message', authMiddleware, controllerThread.sendMessageToThread);

router.delete('/delete/:threadId', authMiddleware, controllerThread.deleteThread);

module.exports = router;
