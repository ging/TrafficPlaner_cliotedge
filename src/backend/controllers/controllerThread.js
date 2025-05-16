// controllerThread.js
const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

const { DateTime } = require('luxon');
const logger = require('../loggerWinston');
const { Conversation } = require('../models');
const { dynamoDB } = require('../config/config.js');
const { ScanCommand } = require('@aws-sdk/client-dynamodb');

// Inicializar la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function toMillis(value) {
    if (typeof value !== 'string') return value;
    //ISO con hora: "YYYY-MM-DDTHH:mm:ss" 
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(value)) {
        const dt = DateTime.fromISO(value, { zone: 'Europe/Madrid' });
        return dt.isValid ? dt.toMillis() : NaN;
    }
    //Es ISO?
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const dt = DateTime.fromISO(value, { zone: 'Europe/Madrid' });
        return dt.isValid ? dt.toMillis() : NaN;
    }

    const dtEs = DateTime.fromFormat(
        value,
        "d 'de' LLLL 'de' yyyy HH:mm:ss",
        { locale: 'es', zone: 'Europe/Madrid' }
    );
    if (dtEs.isValid) return dtEs.toMillis();

    const dtEs2 = DateTime.fromFormat(
        value,
        "d 'de' LLLL 'de' yyyy",
        { locale: 'es', zone: 'Europe/Madrid' }
    );
    if (dtEs2.isValid) return dtEs2.startOf('day').toMillis();
    throw new Error(`No pude parsear la fecha "${value}"`);
}

function toHour(value) {
    // Convierte "HH:mm" o "HH:mm:ss" en segundos desde 00:00
    if (typeof value === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
        const parts = value.split(':').map(Number);
        const [h, m, s = 0] = parts;
        return h * 3600 + m * 60 + s;
    }
    return value;
}

function normalizeFilters(filters) {
    const normalized = {};

    for (const [key, value] of Object.entries(filters)) {

        if (key === 'hour_observed') {
            normalized[key] = typeof value === 'string' ? toHour(value) : value;
            continue;
        }
        if (
            value &&
            typeof value === 'object' &&
            value.type === 'between' &&
            value.start !== undefined &&
            value.end !== undefined
        ) {
            const startMillis = typeof value.start === 'number'
                ? value.start
                : toMillis(value.start);
            const endMillis = typeof value.end === 'number'
                ? value.end
                : toMillis(value.end);

            if (startMillis === endMillis) {
                normalized[key] = startMillis;
            } else {
                normalized[key] = {
                    type: 'between',
                    start: startMillis,
                    end: endMillis
                };
            }
            continue;
        }

        if (typeof value === 'string' || typeof value === 'number') {
            if (!isNaN(Number(value))) {
                normalized[key] = Number(value);
            } else {
                try {
                    normalized[key] = toMillis(value);
                } catch {
                    normalized[key] = value;
                }
            }
            continue;
        }
        // Otros casos (boolean, array, etc.)
        normalized[key] = value;
    }

    return normalized;
}
// Función que escanea una tabla DynamoDB utilizando Parallel Scan para mejorar la velocidad.
const parallelScan = async (tableName, filters = {}, segments = 4, operation = "scan") => {
    logger.info(`Iniciando consulta en la tabla "${tableName}" con operación: ${operation}`);

    if (operation === "count") {
        // Paraleliza
        const tasks = Array.from({ length: segments }, (_, index) =>
            scanSegment(tableName, filters, index, segments, "count")
        );
        const results = await Promise.all(tasks);
        const count = results.reduce((total, segmentCount) => total + segmentCount, 0);
        logger.info(`Consulta COUNT finalizada. Total registros: ${count}`);
        return count;
    } else {
        // Si no es un conteo, usar parallel scan con segmentos
        const tasks = Array.from({ length: segments }, (_, index) =>
            scanSegment(tableName, filters, index, segments, "scan")
        );
        const results = await Promise.all(tasks);
        const items = results.flat();

        logger.info(`ParallelScan completado: Se recuperaron ${items.length} registros de la tabla "${tableName}".`);
        return items;
    }

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

        params.Segment = segment;
        params.TotalSegments = totalSegments;

        // Construcción de los filtros si los hay
        if (filters && Object.keys(filters).length > 0) {
            const filterExpressions = [];
            const expressionAttributeValues = {};
            const expressionAttributeNames = {};

            const typeMap = {
                day_observed: 'N',
                date_observed_unix: 'N',
                date_observed_local: 'N',
                date_observed_utc: 'N',
                date_insert_unix: 'N',
                date_insert_utc: 'N',
                hour_observed: 'N',
                device_id: 'N',
                resource_id: 'N',
                container_id: 'N',
                collection_point_id: 'N',
                municipality: 'S',
                province: 'S',
                country: 'S',
                postal_code: 'S',
                address_name: 'S',
                address_number: 'S',
                waste_type: 'S',
                resource_type: 'S',
                resource_code: 'S',
                resource_license_plate: 'S',
                tag: 'S',
                incidence_group_type: 'S',
                incidence_group_code: 'N',
                incidence_code: 'N',
                observations: 'S',
                uniqueid: 'S',
                geometry: 'S',
                resource_brand: 'S',
                resource_model: 'S',
                resource_classification: 'S',
                distance: 'N',
                speed: 'N',
                carbon_per_km: 'N',
                carbon_print: 'N',
                day_of_week: 'N',
            };

            Object.entries(filters).forEach(([key, filterValue]) => {
                const attr = `#${key}`;
                const valAlias = `:${key}`;
              
                // Rango "between"
                if (typeof filterValue === 'object' && filterValue?.type === 'between' && filterValue.start != null && filterValue.end != null) {
                  expressionAttributeNames[attr] = key;
                  filterExpressions.push(`${attr} BETWEEN ${valAlias}Start AND ${valAlias}End`);
                  expressionAttributeValues[`${valAlias}Start`] = { N: String(filterValue.start) };
                  expressionAttributeValues[`${valAlias}End`]   = { N: String(filterValue.end) };
                }
                // Prefijo "begins_with"
                else if (typeof filterValue === 'object' && filterValue?.type === 'begins_with' && filterValue.value) {
                  expressionAttributeNames[attr] = key;
                  filterExpressions.push(`begins_with(${attr}, ${valAlias}Starts)`);
                  expressionAttributeValues[`${valAlias}Starts`] = { S: filterValue.value };
                }
                // Igualdad simple
                else if (filterValue !== undefined && filterValue !== null) {
                  const dynamoType = typeMap[key] || (isNaN(filterValue) ? 'S' : 'N');
                  expressionAttributeNames[attr] = key;
                  filterExpressions.push(`${attr} = ${valAlias}`);
                  expressionAttributeValues[valAlias] =
                    dynamoType === 'N'
                      ? { N: String(filterValue) }
                      : { S: String(filterValue) };
                }
              });
              
            if (filterExpressions.length > 0) {
                params.FilterExpression = filterExpressions.join(' AND ');
                params.ExpressionAttributeNames = expressionAttributeNames;
                params.ExpressionAttributeValues = expressionAttributeValues;
                logger.info(`[Segmento ${segment}] Filtro: ${params.FilterExpression}`);
                logger.info(`[Segmento ${segment}] AttrNames: ${JSON.stringify(params.ExpressionAttributeNames)}`);
                logger.info(`[Segmento ${segment}] AttrValues: ${JSON.stringify(params.ExpressionAttributeValues)}`);
            }
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
- Para una consulta normal se usa "operation": "scan".
- Si la pregunta es del tipo "¿Cuántas furgonetas…?" o pide un subtipo de vehículo (camiones, motos, etc.) en las tablas **rt_car_access_by_device** o **rt_car_access**, **no** incluyas ningún filtro sobre vehicle_type. Sólo filtra por el resto de campos; el asistente se encargará de leer el JSON de vehicle_type y extraer el número correcto.
- Recuerda que si te pregunta por las detecciones de un día en concreto sin especificar la cámara, se trata de la tabla rt_car_access.

**MUY IMPORTANTE** sobre las fechas:
- Cuando devuelvas filtros para un día concreto, usa "start": "YYYY-MM-DD" y "end": "YYYY-MM-DD"S.
- No pongas timestamps, solo el ISO string.
- El backend se encargará de convertirlos a milisegundos correctamente.
- Cuándo te pregunten por una fecha, te están preguntando por el huso horario de Madrid. Es decir, la zona horaria de Europa Central. De esta forma por ejemplo, el martes 1 de octubre de 2024 en mi zona horaria es 1727733600000.
- El campo "day_observed" está definido como número (N) en DynamoDB. 
- Por lo tanto, **NO** uses "begins_with" con "day_observed".  
- Los ids de las cámaras empiezan con "CT". Por ejemplo el id de la cámara 12 es "CT12". Siempre es CT y dos dígitos. Por ejemplo: CT04.
  Ejemplo:  
  "day_observed": {
    "type": "between",
    "start": <timestampInicioDelDia>,
    "end": <timestampFinDelDia>
  }
- Si el usuario pide un rango de fechas, haz un "type": "between" con "start" y "end".
- Si la pregunta menciona cualquier otro atributo de tf_waste_weights (por ejemplo municipality, waste_type, address_name, hour_observed, device_id, postal_code, etc.), devuelve un filtro de igualdad (o rango si aplica) sobre ese campo.  

TABLAS DISPONIBLES Y EJEMPLOS DE REGISTROS:

1. Tabla: **rt_car_access_by_device**  
Esta tabla contiene información sobre distintas cámaras y las detecciones que se han realizado en ellas según una fecha. Además, se puede consultar el tipo de vehículo y la etiqueta ambiental. Además, está también información sobre la localización de la cámara.
Ejemplo:
{
        "environmental_label": "{\"B\": 358, \"C\": 395, \"ECO\": 58, \"No label\": 148, \"0 Emissions\": 8, \"No identified\": 67}",
        "count_vehicles": 1034,
        "day_observed": 1739055600000,
        "camera_id": "CT10",
        "vehicle_type": "{\"Car\": 980, \"Van\": 34, \"Truck\": 9, \"Motorbike\": 2, \"No identified\": 9}",
        "location": "{\"latitude\": 40.618472, \"longitude\": -3.724701}"
}
        Este ejemplo corresponde a la cámara CT10 el día sábado 8 de febrero de 2025 a las 23:00:00. UTC

2. Tabla: **rt_car_access**  
Esta tabla contiene la información diaria de todas las cámaras. Contiene la información diaria de vehículos y etiqutas ambientales.
Ejemplo:
{
        "environmental_label": "{\"B\": 5153, \"C\": 6417, \"ECO\": 808, \"No label\": 2594, \"0 Emissions\": 179, \"No identified\": 901}",
        "count_vehicles": 16052,
        "day_observed": 1739228400000,
        "vehicle_type": "{\"Bus\": 261, \"Car\": 13403, \"Van\": 1562, \"Truck\": 488, \"Motorbike\": 106, \"No identified\": 232}"
}

3. Tabla: **tf_waste_weights**  
Esta tabla contiene información sobre residuos indicando el municipio, provincia y país. Contiene además la hora y fecha observada y el id del dispositivo con el que se registró el residuo. Además contiene información sobre el vehículo y los residuos. En el siguiente ejemplo tienes todas las columnas de la tabla.
Ejemplo:
{
        "country": "España",
        "day_of_week_cat": "Divendres",
        "year_observed": 2025,
        "incidence_group_code": 201,
        "municipality": "Tres Cantos",
        "incidence_code": 0,
        "date_observed_local": 1743746387000,
        "neighbourhood_code": "\"\"",
        "month_observed": 4,
        "container_code": "Sin identificar",
        "province": "Madrid",
        "neighbourhood": "\"\"",
        "collection_point_observations": "\"\"",
        "tag": "Sin identificar",
        "month_cat": "Abril",
        "day_of_week_es": "Viernes",
        "longitude": -3.7148245,
        "area": "\"\"",
        "device_id": 5,
        "resource_code": "7845MDV",
        "resource_type": "Grúa",
        "date_insert_unix": 1743929939,
        "container_observations": "\"\"",
        "collection_point_reference": null,
        "month_es": "Abril",
        "collection_point_creation_date_utc_unix": 1738582210,
        "operating_time": 0,
        "date_observed_utc": 1743739187000,
        "container_type": "Sin identificar",
        "resource_description": "\"\"",
        "container_id": 0,
        "altitude": 729,
        "incidence_group_type": "Recogida pesaje / RFID",
        "latitude": 40.603788333333334,
        "date_observed_unix": 1743739187,
        "address_name": "Avenida de los Encuartes",
        "collection_point_creation_date_utc": 1738582210000,
        "observations": "No asociada.",
        "resource_license_plate": "7845MDV (VOLVO FE PALVI GRÚA ATLAS)",
        "is_payt": false,
        "incidence_type": "\"\"",
        "uniqueid": "2025-04-04 05:59:47Papel6",
        "date_insert_utc": 1743929939406,
        "collection_point_id": 61,
        "day_observed": 1743717600000,
        "hour_observed": 7,
        "waste_type": "Papel",
        "lifts": 0,
        "waste_weight": 0.0,
        "address_number": "19",
        "service_type": null,
        "resource_id": 6,
        "postal_code": "28760"
    }

4. Tabla: **tf_waste_carbon_print**  

En esta tabla se registran rutas junto con su impacto de carbono. En "resource_code" aparece la matrícula, en "resource_license_plate" la matrícula junto con el modelo.
Ejemplo:
{
        "resource_brand": "VOLVO",
        "day_observed": 1741561200000,
        "device_id": 3,
        "distance": 91.018,
        "resource_code": "3813MHL",
        "carbon_per_km": 0.176,
        "resource_type": "Grúa",
        "resource_model": "FE PALVI GRÚA ATLAS",
        "speed": 19.85636856368564,
        "resource_classification": "B100",
        "carbon_print": 16.019167913198473,
        "resource_id": 3,
        "resource_license_plate": "3813MHL (VOLVO FE PALVI GRÚA ATLAS)",
        "geometry": "LINESTRING (-3.695780666666667 40.61433216666667, ... , -3.6954691666666672 40.61411283333334, -3.695340166666667 40.61409883333333, -3.6954321666666665 40.614107833333335, -3.6955990000000005 40.6141875, -3.6958701666666665 40.6143115, -3.6959204999999997 40.614334666666664, -3.696007666666667 40.61433916666667, -3.6960531666666667 40.61430983333333, -3.696061666666666 40.614303)",
        "uniqueid": "2025-03-1033",
        "day_of_week": 0
    }

5. Tabla: **tf_waste_observed_routes**  
En esta tabla se registran las rutas de los residuos.  En "resource_code" aparece la matrícula, en "resource_license_plate" la matrícula junto con el modelo.
Ejemplo:
{
        "resource_brand": "VOLVO",
        "day_observed": 1743717600000,
        "device_id": 2,
        "distance": 23.579,
        "resource_code": "1219MGR",
        "resource_type": "Grúa",
        "resource_model": "FE GRÚA ATLAS",
        "speed": 9.287081339712918,
        "resource_id": 2,
        "resource_license_plate": "1219MGR (VOLVO FE GRÚA ATLAS)",
        "geometry": "LINESTRING (-3.703763833333333 40.614719, -3.696055666666667 40.61405166666667, -3.696067 40.614064666666664, -3.69621 40.614109500000005, -3.6962105 40.614059833333336, -3.696227833333333 40.61404266666667, -3.6962610000000002 40.61397683333333, -3.6962325000000003 40.61392583333333, -3.6943144999999995 40.61210966666667, ...,-3.6942755 40.6121825, -3.6943743333333336 40.6122325, -3.6962358333333336 40.61405383333333, -3.6961510000000004 40.614129166666665, -3.6960956666666664 40.61417433333334, -3.6960933333333337 40.6141945, -3.696083166666667 40.61424866666667, -3.696093666666667 40.614223833333334)",
        "uniqueid": "2025-04-0422",
        "day_of_week": 4
    }

REQUISITOS ADICIONALES:
- Si te preguntan por rutas y no aparece nada en la tabla tf_waste_observed_routes, es posible que la información esté en tf_waste_carbon_print. Por lo que puede que tengas que mirar las dos tablas.
- Las fechas se guardan en formato Unix (algunos en milisegundos y otros en segundos).
- Si la consulta incluye fechas parciales (por ejemplo: "abril 2025", "el 5 de abril de 2025" o "entre las 10 y las 11 de un día"), el filtro para la fecha se representará mediante un objeto JSON que indique el tipo de comparación ("between").
- Para una consulta que haga referencia a un rango completo de fechas se usará un objeto con "type": "between" y se proporcionarán las propiedades "start" y "end" en formato Unix (por ejemplo: 1743717600000).
- Indica también si se espera una única respuesta o si se requieren múltiples partes para responder.

Ejemplo de respuesta en formato JSON:
{
  "tables": [
    {
      "tableName": "rt_car_access_by_device",
      "filters": {
         "environmental_label": "{\"B\": ...}",
         "day_observed": {
           "type": "between",
           "start": 1743717600000,
           "end": 1743803999999
         }
      },
      "operation": "scan"
    }
  ],
  "multipleParts": false
}

Si para alguna tabla no es necesario aplicar filtros, el objeto filters debe estar vacío, por ejemplo: {"filters": {}}.

Consulta: "${prompt}"
`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            temperature: 0,
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
                    if (typeof value === 'object' && value !== null) {
                        // Se deja el objeto intacto para que se pueda interpretar en scanSegment
                        formattedFilters[key] = value;
                    } else {
                        formattedFilters[key] = String(value);
                    }
                });

                const finalFilters = normalizeFilters(formattedFilters);
                const result = await parallelScan(tableName, finalFilters, 4, operation);
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
            model: 'gpt-4.1-mini',
            temperature: 0
        });

        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: `
            ${prompt}
            
            Interpretación de la consulta:
            ${JSON.stringify(dbQueryInfo, null, 2)}
            
            Resultados de la base de datos:
            ${JSON.stringify(dbResults, null, 2)}
            `
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
                    if (typeof value === 'object' && value !== null) {
                        // Se deja el objeto intacto para que se pueda interpretar en scanSegment
                        formattedFilters[key] = value;
                    } else {
                        formattedFilters[key] = String(value);
                    }
                });


                const finalFilters = normalizeFilters(formattedFilters);
                const result = await parallelScan(tableName, finalFilters, 4, operation);
                dbResults[tableName] = result;
            }
        }

        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: `
            ${prompt}
            
            Interpretación de la consulta:
            ${JSON.stringify(dbQueryInfo, null, 2)}
            
            Resultados de la base de datos:
            ${JSON.stringify(dbResults, null, 2)}
            `
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