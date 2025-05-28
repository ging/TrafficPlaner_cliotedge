const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

// Inicializar la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Controlador que maneja la solicitud y llamar a la API de OpenAI
const getOpenAIResponse = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).send({ error: 'No se proporcionó un prompt en el cuerpo de la solicitud.' });
    }

    try {
        // Llamada a la API de OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });

        // Extraer la respuesta del modelo GPT-4o
        const gptResponse = response.choices[0].message.content;

        // Enviar la respuesta al cliente
        res.send({ response: gptResponse });
    } catch (error) {
        console.error('Error llamando a la API de OpenAI:', error);
        res.status(500).send({ error: 'Error llamando a la API de OpenAI' });
    }
};

module.exports = {
    getOpenAIResponse,
};
