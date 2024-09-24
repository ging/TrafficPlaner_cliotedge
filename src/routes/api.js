const express = require('express');
const controllerOpenAI = require('../controllers/controllerOpenAI');

const router = express.Router();

// Ruta para obtener la respuesta de OpenAI
router.post('/', controllerOpenAI.getOpenAIResponse);

module.exports = router;
