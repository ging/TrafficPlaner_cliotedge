const { OpenAI } = require('openai');
const logger = require('../loggerWinston');
require('dotenv').config({ path: './backend/.env' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware que decide si la pregunta está dentro de lo que puede responder.
const railGuard = async (req, res, next) => {
    if (process.env.rail_enabled === 'false') return next();

    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt vacío.' });

    try {
        const systemPrompt = `
Eres un clasificador.  
DOMINIO PERMITIDO (ALLOWED):
- Preguntas sobre movilidad urbana, tráfico, residuos, rutas, etiquetas medioambientales, métricas de carbono, entre otras. La información sobre la que puedes responder está relacionada con las siguientes tablas:

Estas tablas son de ejemplo, tienes que permitir cualquier pregunta que se puede parecer así como información sobre el tráfico, residuos, rutas y etiquetas medioambientales.
 Por ejemplo:
- ¿Cuántos vehículos registró la cámara 2 el 4 de febrero de 2025? -> se permite
- ¿Qué opinas del real madrid? -> no se permite



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

DOMINIO NO PERMITIDO (NOT_ALLOWED):
- Cualquier otro asunto (política, medicina, datos personales, chistes, programación, etc.)

Responde **únicamente** con JSON válido, sin texto adicional, con esta forma:
{
  "allowed": true|false,
  "reason": "breve explicación en español"
}`;
        const completion = await openai.chat.completions.create({
            model: process.env.model,
            temperature: 0,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        });

        const raw = completion.choices[0].message.content.trim()
            .replace(/```json|```/g, '');
        const verdict = JSON.parse(raw);

        
        console.log('=========================================');
        console.log('Rail verdict:', verdict);
        console.log('=========================================');


        if (!verdict.allowed) {
            logger.warn(`Pregunta bloqueada por rail: ${verdict.reason}`);
            return res.status(403).json({
                error: 'Pregunta fuera de ámbito.',
                reason: verdict.reason
            });
        }


        req.railVerdict = verdict;
        next();
    } catch (err) {
        logger.error('Error en railGuard:', err);
        return res.status(500).json({ error: 'Error evaluando la pregunta.' });
    }
};

module.exports = railGuard;
