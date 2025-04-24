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
            }
        ];

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        let passed = 0;
        const total = tests.length;
        let threadId, assistantId;

        console.log(`Ejecutando el benchmark (${total} tests)…\n`);

        // Loop de tests
        for (let i = 0; i < total; i++) {
            const { prompt, expected } = tests[i];
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

                const ok = expected.some(exp => answer.includes(exp));
                console.log(ok ? '✅' : '❌');

                console.log(`  Prompt   : ${prompt}`);
                console.log(`  Esperado : [${expected.join(', ')}]`);
                console.log(`  Respuesta: ${answer}\n`);
                if (ok) passed++;

            } catch (err) {
                console.log('⚠️ Error');
                console.log(`  Prompt   : ${prompt}`);
                console.log(`  Error    : ${err.message}\n`);
            }
        }

        console.log(`📊 Resultado final: ${passed} de ${total} tests pasados`);

    } catch (err) {
        console.error('🚨 Falló el benchmark:', err.message);
        process.exit(1);
    }
})();
