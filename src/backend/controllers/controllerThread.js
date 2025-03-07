// controllerThread.js
const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

const logger = require('../loggerWinston');
const { Conversation } = require('../models');
const { dynamoDB } = require('../config/config.js');
const { ScanCommand } = require('@aws-sdk/client-dynamodb');

// Inicializar la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


// Función que escanea una tabla DynamoDB utilizando Parallel Scan para mejorar la velocidad.

const parallelScan = async (tableName, filters = {}, segments = 4, operation = "scan") => {
    logger.info(`Iniciando consulta en la tabla "${tableName}" con operación: ${operation}`);

    if (operation === "count") {
        // Realiza solo una consulta COUNT sin dividir en segmentos
        const count = await scanSegment(tableName, filters, 0, 1, "count");
        logger.info(`Consulta COUNT finalizada. Total registros: ${count}`);
        return count;
    }

    // Si no es un conteo, usar parallel scan con segmentos
    const tasks = Array.from({ length: segments }, (_, index) => scanSegment(tableName, filters, index, segments, "scan"));
    const results = await Promise.all(tasks);
    const items = results.flat();

    logger.info(`ParallelScan completado: Se recuperaron ${items.length} registros de la tabla "${tableName}".`);
    return items;
};

// Función que escanea un segmento específico de la tabla con filtros.
const scanSegment = async (tableName, filters, segment, totalSegments, operation = "scan") => {
    let count = 0;
    let items = [];
    let lastEvaluatedKey = null;

    do {
        const params = {
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey
        };

        // Construcción de los filtros si los hay

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
                expressionAttributeValues[valueAlias] = { S: filters[key] };
            });

            params.FilterExpression = filterExpressions.join(' AND ');
            params.ExpressionAttributeNames = expressionAttributeNames;
            params.ExpressionAttributeValues = expressionAttributeValues;
        }

        if (operation === "count") {
            params.Select = "COUNT"; 
        }

        try {
            const command = operation === "count" ? new ScanCommand(params) : new ScanCommand(params);
            const result = await dynamoDB.send(command);

            if (operation === "count") {
                count += result.Count; 
            } else {
                items = items.concat(result.Items || []);
            }

            lastEvaluatedKey = result.LastEvaluatedKey;
            logger.info(`[Segmento ${segment}] Se recuperaron ${operation === "count" ? result.Count : result.Items?.length || 0} registros.`);
        } catch (error) {
            logger.error(`Error en ParallelScan (segmento ${segment}):`, error);
        }

    } while (lastEvaluatedKey);

    logger.info(`[Segmento ${segment}] Finalizado. Total registros: ${operation === "count" ? count : items.length}`);
    
    return operation === "count" ? count : items;
};



//Función que invoca al LLM para analizar el prompt del usuario y determinar:
// - Qué tablas de DynamoDB deben consultarse.
//- Para cada tabla, si se deben aplicar filtros.
const analyzePromptForDBQuery = async (prompt) => {
    const dbPrompt = `
Analiza la siguiente consulta del usuario y determina qué tablas de la base de datos DynamoDB deben ser consultadas y, para cada tabla, si es necesario, indica los filtros a aplicar.

IMPORTANTE:  
- Si la consulta del usuario implica un **conteo** (por ejemplo: "¿Cuántos vehículos hay?", "Dame el total de detecciones"), entonces agrega el campo "operation": "count".
- Si es una consulta normal, usa "operation": "scan".

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


  Requisito Adicional:  
Indica si se espera una única respuesta o si se requieren múltiples partes para responder.

Ejemplo de respuesta. Responde en formato JSON de la siguiente forma:
{
  "tables": [
    {"tableName": "Vehicles", "filters": {"EmissionType": "1"}, "operation": "count"}
  ],
  "multipleParts": false
}

Si para alguna tabla no es necesario aplicar filtros, el objeto filters debe estar vacío, por ejemplo: {"filters": {}}.

Consulta: "${prompt}"
`;
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'Eres un asistente que ayuda a interpretar consultas para DynamoDB. Responde solo en JSON válido sin agregar texto adicional.' },
                { role: 'user', content: dbPrompt }
            ]
        });

        let resultText = response.choices[0].message.content;

        // Limpieza de la respuesta para asegurar JSON válido
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

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
            return res.status(400).send({ error: 'No se proporcionó un prompt.' });
        }

        // Analizamos el prompt para determinar si se requiere consulta a DB
        const dbQueryInfo = await analyzePromptForDBQuery(prompt);
        const tablesToQuery = dbQueryInfo.tables;
        let dbResults = {};
        let warnings = {};

        if (tablesToQuery.length > 0) {
            for (const { tableName, filters, operation } of dbQueryInfo.tables) {
                const formattedFilters = {};
                Object.entries(filters).forEach(([key, value]) => {
                    formattedFilters[key] = String(value);
                });
            
                const result = await parallelScan(tableName, formattedFilters, 4, operation);
                dbResults[tableName] = result; // Guardar solo el conteo si es COUNT
            
                if (!Object.keys(filters).length) {
                    warnings[tableName] = `No se aplicaron filtros en "${tableName}".`;
                }
            }            
        }

        const thread = await openai.beta.threads.create({});
        const assistant = await openai.beta.assistants.create({
            instructions: `
                Eres un experto en tráfico y movilidad.  
                
                **Instrucción General:**  
                Responde a la pregunta: "${prompt}" usando todos los datos proporcionados.  

                **Instrucción Crítica:**  
                Siempre responde **solo a la última pregunta recibida**.  
                Si se envía una nueva pregunta, **ignora todo el contexto anterior**. 

                **Importante:**  
                Si recibes múltiples partes, **espera hasta tenerlas todas**.  
                Si recibes **una sola parte**, **responde directamente**. 
                
                **Instrucción de la base de datos:**
                Si la pregunta es de tipo "¿Cuántos vehículos que cumplan esta condición hay?" Y se te pasa un número, ese es el número de vehículos que cumplen la condición.
            `,
            model: 'gpt-4o'
        });

        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: `${prompt}\n\nDatos de la consulta: ${JSON.stringify(dbResults)}`
        });
        
        const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistant.id });

        await new Promise(resolve => {
            const interval = setInterval(async () => {
                const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
                if (runStatus.status === 'completed') {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
        // Recuperar todos los mensajes del thread
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant')?.content[0];

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
        logger.error('Error en createThread:', error);
        res.status(500).send({ error: 'Error en la creación del thread.' });
    }
};

// Función para enviar un mensaje al thread existente 
const sendMessageToThread = async (req, res) => {
    try {
        const { threadId, assistantId, prompt } = req.body;

        if (!threadId || !assistantId || !prompt) {
            return res.status(400).send({ error: 'Faltan parámetros.' });
        }

        const clearContextPrompt = `**Nueva Pregunta**  
                                    Por favor, olvida todo el contexto anterior y responde únicamente a esta nueva pregunta: "${prompt}"`;
        

        const dbQueryInfo = await analyzePromptForDBQuery(prompt);
        let dbResults = {};

        if (dbQueryInfo.tables.length > 0) {
            for (const { tableName, filters, operation } of dbQueryInfo.tables) {
                const formattedFilters = {};
                Object.entries(filters).forEach(([key, value]) => {
                    formattedFilters[key] = String(value);
                });
            
                const result = await parallelScan(tableName, formattedFilters, 4, operation);
                dbResults[tableName] = result;
            }            
        }

        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: `${prompt}\n\nDatos de la consulta: ${JSON.stringify(dbResults)}`
        });
        
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });

        await new Promise(resolve => {
            const interval = setInterval(async () => {
                const runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
                if (runStatus.status === 'completed') {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });

        // Recupera los mensajes y extraer la respuesta.
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantResponse = messages.data.find(m => m.role === 'assistant')?.content[0];

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