// benchmark.js

const axios = require('axios');

(async () => {
    try {
        // Configuración
        const HOST = 'http://localhost:3002';
        const CTX = '/cliotedge';
        const USER = 'admin';
        const PASS = 'password';

        // Login
        console.log('🔐 Autenticando…');
        const loginRes = await axios.post(
            `${HOST}${CTX}/threads/login`,
            { username: USER, password: PASS },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const token = loginRes.data.token;
        if (!token) throw new Error('No se recibió token');
        console.log('✔ Token OK\n');

        // Definición de tests
        const tests = [
            {
                prompt: '¿Cuál fue la huella de carbono del vehículo 9799MDY el 22 de diciembre de 2024?',
                expected: ['10.696575942039491', '10.696', '10.7', '10.697']
            },
            {
                prompt: '¿Qué distancia recorrió el vehículo de matrícula 8502MCR el 7 de febrero de 2025?',
                expected: ['64.336', '64.34']
            },
            {
                prompt: '¿Qué distancia recorrió el vehículo 1219MGR el día 30 de abril de 2025?',
                expected: ['65.018', '65.0']
            },
            {
                prompt: '¿A qué velocidad fue el vehículo 7456GWH el día 4 de febrero de 2025?',
                expected: ['11.570713391739675', '11.57', '11.6']
            },
            {
                prompt: '¿Cuál fue la huella de carbono del vehículo 9801MDY el 26 de enero de 2025?',
                expected: ['10.875039941072464', '10.875', '10.8']

            },
            {
                prompt: '¿Cuántos vehículos registró la cámara 2 el 4 de febrero de 2025?',
                expected: ['2285', '2,285']
            },
            {
                prompt: '¿Cuántas furgonetas detectó la cámara 5 el 4 de noviembre de 2024?',
                expected: ['427']
            },
            {
                prompt: '¿Cuántos vehículos con etiqueta ECO detectó la cámara 2 el 4 de febrero de 2025?',
                expected: ['92']
            },
            {
                prompt: '¿Cuál fue la huella de carbono total del dispositivo 7 el 04 de marzo de 2025?',
                expected: ['13.673791925907134', '13.67']
            },
            {
                prompt: '¿Qué distancia recorrió el vehículo de matrícula 3813MHL​ el 4 de abril de 2025?',
                expected: ['45.706']
            },
            {
                prompt: '¿Cuántos vehículos fueron detectados el día 30 de enero de 2025 por la cámara 17?',
                expected: ['2162', '2,162']
            },
            {
                prompt: '¿Cuántas motos se detectaron en total el día 22 de octubre de 2024?',
                expected: ['389']
            },
            {
                prompt: '¿Cuál fue la huella de carbono detectada el día 8 de marzo de 2025 por el vehículo de matrícula 7845MDV?',
                expected: ['19.68172789335251', '19.68']
            },
            {
                prompt: '¿Cuál es el tipo de residuo recogido el día 4 de abril de 2025, en el punto de recolección 131 por el vehículo con matrícula 7845MDV?',
                expected: ['Papel']
            },
            {
                prompt: '¿Qué distancia recorrió el vehículo de matrícula 7845MDV el día 7 de marzo de 2025?',
                expected: ['78.424']
            },
            {
                prompt: '¿Cuántos vehículos con etiqueta ECO se registraron el 7 de febrero de 2025?',
                expected: ['2912', '2,912']
            },
            {
                prompt: '¿Cuántos camiones se registraron el 7 de febrero de 2025?',
                expected: ['896']
            },
            {
                prompt: '¿Cuántos vehículos registró la cámara 3 el 8 de febrero de 2025?',
                expected: ['4295', '4,295']
            },
            {
                prompt: '¿Cuántos vehículos con etiqueta ECO detectó la cámara 3 el 8 de febrero de 2025?',
                expected: ['186']
            },
            {
                prompt: '¿Cuántas furgonetas detectó la cámara 3 el 8 de febrero de 2025?',
                expected: ['168']
            },
            {
                prompt: '¿Qué distancia recorrió el vehículo de matrícula 1219MGR el 4 de abril de 2025?',
                expected: ['23.579']
            },
            {
                prompt: '¿Cuál fue la velocidad media del vehículo de matrícula 1219MGR el 4 de abril de 2025?',
                expected: ['9.287081339712918', '9.29', '9.287']
            },
            {
                prompt: '¿Qué distancia recorrió el dispositivo 6 el 8 de marzo de 2025?',
                expected: ['4.695']
            },
            {
                prompt: '¿Cuál fue la velocidad media del dispositivo 6 el 8 de marzo de 2025?',
                expected: ['13.038167938931299', '13.04', '13.038']
            },
            {
                prompt: '¿Cuál fue la clasificación de combustible del dispositivo 3 el 10 de marzo de 2025?',
                expected: ['B100']
            },
            {
                prompt: '¿Cuál fue el peso de residuos del tipo Envases recogido el 4 de abril de 2025 en el punto de recolección 3?',
                expected: ['0.0', '0']
            },
            {
                prompt: '¿Cuántos vehículos con etiqueta C detectó la cámara CT12 el 7 de febrero de 2025?',
                expected: ['817']
            },
            {
                prompt: '¿Cuál fue el número de vehículos sin etiqueta detectados por la cámara CT13 el 7 de febrero de 2025?',
                expected: ['1018', '1,018']
            },
            {
                prompt: '¿Cuántos camiones registró la cámara CT13 el 7 de febrero de 2025?',
                expected: ['75']
            },
            {
                prompt: '¿Cuántos coches registró la cámara CT11 el 7 de febrero de 2025?',
                expected: ['508']
            },
            {
                prompt: '¿A qué hora se observó el residuo tipo Papel en el punto de recolección 143 por el recurso 7845MDV el 4 de abril de 2025?',
                expected: ['9']
            },
            {
                prompt: '¿Cuántos vehículos con etiqueta 0 Emissions se registraron el 7 de febrero de 2025?',
                expected: ['679']
            },
            {
                prompt: '¿Cuántos camiones detectó la cámara CT11 el 7 de febrero de 2025?',
                expected: ['7']
            },
            {
                prompt: '¿Cuál fue el carbono por kilómetro del dispositivo 6 el 9 de marzo de 2025?',
                expected: ['0.176']
            },
            {
                prompt: '¿A qué hora se observó el residuo tipo Papel en el punto de recolección 67 por el recurso 7845MDV el 4 de abril de 2025?',
                expected: ['8']
            }
        ];

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        let passed = 0;
        const total = tests.length;
        let threadId, assistantId;

        const startAll = Date.now();
        console.log(`Ejecutando el benchmark (${total} tests)…\n`);

        // Loop de tests
        for (let i = 0; i < total; i++) {
            const { prompt, expected } = tests[i];
            const testStart = Date.now();
            process.stdout.write(`Test ${i + 1}/${total}… `);

            try {
                let answer;

                if (i === 0) {
                    // Primera pregunta: crea thread
                    const res = await axios.post(
                        `${HOST}${CTX}/threads/create`,
                        { prompt },
                        { headers }
                    );
                    threadId = res.data.threadId;
                    assistantId = res.data.assistantId;
                    answer = res.data.response?.text?.value?.trim() || '';
                } else {
                    // Resto de preguntas: envía mensaje al thread existente
                    const res = await axios.post(
                        `${HOST}${CTX}/threads/message`,
                        { threadId, assistantId, prompt },
                        { headers }
                    );
                    answer = res.data.response?.text?.value?.trim() || '';
                }

                const duration = Date.now() - testStart;
                const ok = expected.some(exp => answer.includes(exp));
                console.log(ok ? '✅' : '❌', `(tiempo: ${duration} ms)`);

                console.log(`  Prompt   : ${prompt}`);
                console.log(`  Esperado : [${expected.join(', ')}]`);
                console.log(`  Respuesta: ${answer}\n`);
                if (ok) passed++;

            } catch (err) {
                const duration = Date.now() - testStart;
                console.log('⚠️ Error', `(tiempo: ${duration} ms)`);
                console.log(`  Prompt   : ${prompt}`);
                console.log(`  Error    : ${err.message}\n`);
            }
        }

        const totalDuration = Date.now() - startAll;
        console.log(`📊 Resultado final: ${passed} de ${total} tests pasados`);
        console.log(`⏱️ Tiempo total del benchmark: ${totalDuration} ms`);

    } catch (err) {
        console.error('🚨 Falló el benchmark:', err.message);
        process.exit(1);
    }
})();
