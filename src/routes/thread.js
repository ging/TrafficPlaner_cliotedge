const express = require('express');
const controllerThread = require('../controllers/controllerThread');

const router = express.Router();

// Crear un nuevo thread y asistente
router.post('/create', controllerThread.createThread);

// Enviar un mensaje en un thread existente
router.post('/message', controllerThread.sendMessageToThread);

module.exports = router;
