const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

const datos = require('../datos/datos_huerto.json')

const logger = require('../loggerWinston');

const { Conversation } = require('../models');


// Inicializar la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Crear un thread y un asistente
const createThread = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).send({ error: 'No se proporcionó un prompt en el cuerpo de la solicitud.' });
        }

        // Crea un nuevo thread 
        const thread = await openai.beta.threads.create({});

        // Instrucciones asistente
        // const instructions = 'Eres un asistente que responde preguntas y sigue conversaciones.';
        const instructions = `Eres un asistente que va a responder preguntas sobre un huerto urbano. Por favor limita tus respuestas a estos datos: ${JSON.stringify(datos)}`
        const assistant = await openai.beta.assistants.create({
            instructions: instructions,
            model: 'gpt-4o',
        });

        // Crea la primera solicitud al asistente
        const message = await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt,
        });

        // Ejecutar el thread y obtener la respuesta del asistente
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id,
        });

        // Esperar a que el thread se complete
        const checkRun = async () => {
            return new Promise((resolve) => {
                const interval = setInterval(async () => {
                    const retrieveRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
                    if (retrieveRun.status === 'completed') {
                        clearInterval(interval);
                        resolve(retrieveRun);
                    }
                }, 1000);
            });
        };

        await checkRun();

        // Recuperar todos los mensajes del thread
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find((m) => m.role === 'assistant')?.content[0];

        // Guardar la nueva conversación en la base de datos como activa
        await createConversation(thread.id);

        // Devolver el threadId y la respuesta del asistente para poder continuar la conversación en caso de querer mantener el hilo
        res.send({ threadId: thread.id, assistantId: assistant.id, response: assistantResponse });

    } catch (error) {
        logger.error('Error creando el thread:', error);
        res.status(500).send({ error: 'Error creando el thread.' });
    }
};


// Crear una nueva conversación en la base de datos
const createConversation = async (threadId) => {
    try {
        const newConversation = await Conversation.create({
            threadId,
            state: 'activa'
        });
        logger.info('Nueva conversación creada:', newConversation);
    } catch (error) {
        logger.error('Error creando la conversación:', error);
    }
};

// Enviar una pregunta usando un thread que ya existente
const sendMessageToThread = async (req, res) => {
    try {
        const { threadId, assistantId, prompt } = req.body;

        if (!threadId || !assistantId || !prompt) {
            return res.status(400).send({ error: 'Faltan datos en la solicitud (threadId, assistantId, prompt).' });
        }

        // Añadir el mensaje al thread 
        const message = await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: prompt,
        });

        // Ejecutar el thread con el asistente 
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
        });

        // Esperar a que el thread se complete
        const checkRun = async () => {
            return new Promise((resolve) => {
                const interval = setInterval(async () => {
                    const retrieveRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
                    if (retrieveRun.status === 'completed') {
                        clearInterval(interval);
                        resolve(retrieveRun);
                    }
                }, 1000);
            });
        };

        await checkRun();

        // Recuperar todos los mensajes del thread
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantResponse = messages.data.find((m) => m.role === 'assistant')?.content[0];

        // Devolver la respuesta del asistente
        res.send({ response: assistantResponse });

    } catch (error) {
        logger.error('Error enviando mensaje al thread:', error);
        res.status(500).send({ error: 'Error enviando mensaje al thread.' });
    }
};

const deleteThread = async (req, res) => {
    try{
        const {threadId} = req.params;

        if (!threadId) {
            return res.status(400).send({ error: 'No se proporcionó un threadId en la solicitud.' });
        }

        // Cambiar el estado de la conversación a 'inactiva'
        await updateConversation(threadId, 'inactiva');

        // Borrar el thread usando su id
        const response = await openai.beta.threads.del(threadId);

        // Verificación si se ha eliminado correctamente
        if (response.deleted) {
            res.send({ message: `Thread con ID ${threadId} eliminado correctamente.` });
        } else {
            res.status(500).send({ error: 'No se pudo eliminar el thread.' });
        }

    } catch (error) {
        logger.error('Error borrando el thread:', error);
        res.status(500).send({ error: 'Error borrando el thread.' });
    }

}

// Actualizar el estado de una conversación en la base de datos
const updateConversation = async (threadId, nuevoState) => {
    try {
        const conversation = await Conversation.findOne({ where: { threadId } });
        if (conversation) {
            conversation.state = nuevoState;
            await conversation.save();
            logger.info('Conversación actualizada:', conversation);
        } else {
            logger.warn('No se encontró la conversación.');
        }
    } catch (error) {
        logger.error('Error actualizando la conversación:', error);
    }
};

module.exports = {
    createThread,
    sendMessageToThread,
    deleteThread,
};
