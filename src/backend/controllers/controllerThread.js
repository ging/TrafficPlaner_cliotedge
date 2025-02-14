// controllerThread.js
const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

const datos = require('../datos/datos_huerto.json');
const logger = require('../loggerWinston');
const { Conversation } = require('../models');
const { dynamoDB } = require('../config/config.js');
const { ScanCommand } = require('@aws-sdk/client-dynamodb');

// Inicializar la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


//Función auxiliar para construir la consulta (Scan) para DynamoDB.
// Si se proporcionan filtros, se crea la FilterExpression y se definen los valores.

const buildScanParams = (tableName, filters) => {
    const params = {
        TableName: tableName,
    };
    if (filters && Object.keys(filters).length > 0) {
        const filterKeys = Object.keys(filters);
        const filterExpressions = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        filterKeys.forEach(key => {
            // Definimos un alias para el nombre del atributo 
            const attributeAlias = `#${key}`;
            const valueAlias = `:${key}`;
            filterExpressions.push(`${attributeAlias} = ${valueAlias}`);
            // Mapeamos el alias al nombre real
            expressionAttributeNames[attributeAlias] = key;
            // Definimos el valor correspondiente
            expressionAttributeValues[valueAlias] = { S: filters[key].toString() };
        });

        params.FilterExpression = filterExpressions.join(' AND ');
        params.ExpressionAttributeValues = expressionAttributeValues;
        params.ExpressionAttributeNames = expressionAttributeNames;
    }
    return params;
};



//Función que invoca al LLM para analizar el prompt del usuario y determinar:
// - Qué tablas de DynamoDB deben consultarse.
//- Para cada tabla, si se deben aplicar filtros.

const analyzePromptForDBQuery = async (prompt) => {
    const dbPrompt = `
Analiza la siguiente consulta del usuario y determina qué tablas de la base de datos DynamoDB deben ser consultadas y, para cada tabla, si es necesario, indica los filtros a aplicar.

Las tablas disponibles y ejemplos de registros son:

- Cameras  
  Ejemplos:
{"Item":{"CameraID":{"S":"22"},"Type":{"S":"Middle"}}}
{"Item":{"CameraID":{"S":"18"},"Type":{"S":"Entry"}}}
{"Item":{"CameraID":{"S":"13"},"Type":{"S":"Both"}}}
{"Item":{"CameraID":{"S":"8"},"Type":{"S":"Exit"}}}

- Vehicles  
  Ejemplos:
  {"Item": {"VehicleID": "D68B", "EmissionType": "1", "VehicleType": "Car"}}
  {"Item": {"VehicleID": "98A6", "EmissionType": "4", "VehicleType": "Motorbike"}}
  {"Item": {"VehicleID": "88F8", "EmissionType": "4", "VehicleType": "Truck"}}
  {"Item": {"VehicleID": "2B07", "EmissionType": "3", "VehicleType": "Bike"}}
  {"Item": {"VehicleID": "1DA5", "EmissionType": "1", "VehicleType": "Truck"}}



- Detections  
  Ejemplos:
  {"Item": {"DetectionID": "546806", "Date": "2024_09_19_14_35_38", "CameraID": "2", "Dir": "0", "VehicleID": "9E7B"}}
  {"Item": {"DetectionID": "671479", "Date": "2024_10_31_10_19_44", "CameraID": "20", "Dir": "0", "VehicleID": "C2A9"}}

  Las fechas están en formato "YYYY_MM_DD_HH_MM_SS".

Responde en formato JSON de la siguiente forma:
{
  "tables": [
    {"tableName": "Vehicles", "filters": {"EmissionType": "1"} },
    {"tableName": "Detections", "filters": {"VehicleID": "4965"} }
  ]
}

Si para alguna tabla no es necesario aplicar filtros, el objeto filters debe estar vacío, por ejemplo: {"filters": {}}.

Consulta: "${prompt}"
`;
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un asistente que ayuda a determinar qué tablas y filtros se deben aplicar para consultar una base de datos DynamoDB. Responde únicamente en JSON sin texto adicional.'
                },
                { role: 'user', content: dbPrompt }
            ]
        });
        let resultText = response.choices[0].message.content;
        // Eliminar delimitadores de bloque de código (por ejemplo, ```json)
        resultText = resultText.replace(/```/g, '').trim();
        // Extraer el primer bloque JSON que aparezca en la respuesta
        const jsonStart = resultText.indexOf('{');
        const jsonEnd = resultText.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('No se encontró un bloque JSON en la respuesta del LLM.');
        }
        const jsonText = resultText.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonText);
    } catch (error) {
        logger.error('Error analizando el prompt para consulta DB:', error);
        return { tables: [] };
    }
};


// Crear un nuevo thread de conversación con el asistente de OpenAI.
const createThread = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).send({ error: 'No se proporcionó un prompt en el cuerpo de la solicitud.' });
        }

        // Analizamos el prompt para determinar si se requiere consulta a DB
        const dbQueryInfo = await analyzePromptForDBQuery(prompt);
        const tablesToQuery = dbQueryInfo.tables;
        let dbResults = {};
        let warnings = {};

        if (Array.isArray(tablesToQuery) && tablesToQuery.length > 0) {
            // Ejecutar la consulta para cada tabla indicada
            for (const tableInfo of tablesToQuery) {
                const { tableName, filters } = tableInfo;
                const params = buildScanParams(tableName, filters);
                const command = new ScanCommand(params);
                const result = await dynamoDB.send(command);
                dbResults[tableName] = result.Items;
                // Si no se aplicaron filtros, se incluye un aviso.
                if (!filters || Object.keys(filters).length === 0) {
                    warnings[tableName] = `Atención: No se aplicaron filtros. Se han consultado todos los registros de la tabla ${tableName}.`;
                }
            }
        }

        // Construir las instrucciones para el asistente.
        // Si se obtuvo información de la base de datos, se la incluye en las instrucciones;
        // de lo contrario, se usa un mensaje por defecto.
        const instructions = Object.keys(dbResults).length > 0
            ? `Eres un experto en tráfico y movilidad. Utiliza la siguiente información proveniente de la base de datos para responder: ${JSON.stringify(dbResults)}. Responde de forma precisa y detallada a las preguntas relacionadas con el tráfico, limitándote a los datos disponibles.`
            : `Eres un experto en tráfico y movilidad. Responde de forma precisa y detallada a las preguntas relacionadas con el tráfico.`;

        // Crear el thread de conversación
        const thread = await openai.beta.threads.create({});
        const assistant = await openai.beta.assistants.create({
            instructions: instructions,
            model: 'gpt-4o',
        });

        // Crear el primer mensaje del usuario en el thread
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt,
        });

        // Ejecutar el thread y obtener la respuesta del asistente
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id,
        });

        // Función para esperar a que el run se complete
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

        // Guardar la conversación en la base de datos como activa
        await createConversation(thread.id);

        // Responder incluyendo además los posibles avisos y la interpretación de la consulta
        res.send({
            threadId: thread.id,
            assistantId: assistant.id,
            response: assistantResponse,
            warnings,
            dbData: dbResults,
            queryInterpretation: dbQueryInfo
        });
    } catch (error) {
        logger.error('Error creando el thread o consultando la DB:', error);
        res.status(500).send({ error: 'Error creando el thread o consultando la base de datos.' });
    }
};

const sendMessageToThread = async (req, res) => {
    try {
        let { threadId, assistantId, prompt } = req.body;
        if (!threadId || !assistantId || !prompt) {
            return res.status(400).send({ error: 'Faltan datos en la solicitud (threadId, assistantId, prompt).' });
        }

        // Analizamos el nuevo prompt para ver si se requiere consulta a la base de datos.
        const dbQueryInfo = await analyzePromptForDBQuery(prompt);
        const tablesToQuery = dbQueryInfo.tables;
        let dbResults = {};
        let warnings = {};

        if (Array.isArray(tablesToQuery) && tablesToQuery.length > 0) {
            // Ejecutamos la consulta para cada tabla indicada.
            for (const tableInfo of tablesToQuery) {
                const { tableName, filters } = tableInfo;
                const params = buildScanParams(tableName, filters);
                const command = new ScanCommand(params);
                const result = await dynamoDB.send(command);
                dbResults[tableName] = result.Items;
                if (!filters || Object.keys(filters).length === 0) {
                    warnings[tableName] = `Atención: No se aplicaron filtros. Se han consultado todos los registros de la tabla ${tableName}.`;
                }
            }
            // Se reformula el prompt para que el asistente ignore el contexto anterior.
            prompt = `Ignora todo el contexto previo. Datos actualizados de la base de datos: ${JSON.stringify(dbResults)}.\n\nPregunta: ${prompt}`;
        }

        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: prompt,
        });

        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
        });

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

        // Recupera los mensajes y extraer la respuesta.
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantResponse = messages.data.find((m) => m.role === 'assistant')?.content[0];

        res.send({ response: assistantResponse });
    } catch (error) {
        logger.error('Error enviando mensaje al thread:', error);
        res.status(500).send({ error: 'Error enviando mensaje al thread.' });
    }
};




// Función que elimina un thread de la base de datos.
const deleteThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        if (!threadId) {
            return res.status(400).send({ error: 'No se proporcionó un threadId en la solicitud.' });
        }
        await updateConversation(threadId, 'inactiva');
        const response = await openai.beta.threads.del(threadId);
        if (response.deleted) {
            res.send({ message: `Thread con ID ${threadId} eliminado correctamente.` });
        } else {
            res.status(500).send({ error: 'No se pudo eliminar el thread.' });
        }
    } catch (error) {
        logger.error('Error borrando el thread:', error);
        res.status(500).send({ error: 'Error borrando el thread.' });
    }
};

// Función para crear una conversación en la base de datos 
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

// Función para actualizar el estado de la conversación en la base de datos
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