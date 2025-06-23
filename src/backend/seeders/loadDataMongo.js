// src/backend/seeders/loadDataMongo.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

// Schemas Mongoose
const rtCarAccess = require('../mongoSchemas/rtCarAccess');
const rtCarAccessByDevice = require('../mongoSchemas/rtCarAccessByDevice');
const tfWasteCarbonPrint = require('../mongoSchemas/tfWasteCarbonPrint');
const tfWasteObservedRoutes = require('../mongoSchemas/tfWasteObservedRoutes');
const tfWasteWeights = require('../mongoSchemas/tfWasteWeights');

const dataDir = path.join(__dirname, '../datos/Datos3Cantos');

const MODEL_MAPPING = {
    'carbon_print.json': tfWasteCarbonPrint,
    'observed_routes.json': tfWasteObservedRoutes,
    'rt_car_access_by_device.json': rtCarAccessByDevice,
    'rt_car_access.json': rtCarAccess,
    'tf_waste_weights.json': tfWasteWeights
};

const TRUNCATE = process.argv.includes('--truncate') || process.argv.includes('-t');

async function main() {
    try {
        // Construye la URI de conexión a partir de las vars de entorno
        const {
            MONGO_INITDB_ROOT_USERNAME: user,
            MONGO_INITDB_ROOT_PASSWORD: pass,
            MONGO_HOST: host,
            MONGO_PORT: port,
            MONGO_INITDB_DATABASE: db
        } = process.env;

        const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?authSource=admin`;
        await mongoose.connect(uri);
        console.log('✅ Conectado a MongoDB');

        for (const [fileName, Model] of Object.entries(MODEL_MAPPING)) {
            const fullPath = path.join(dataDir, fileName);
            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️  No existe ${fileName}, se omite.`);
                continue;
            }

            console.log(`\n→ Procesando ${fileName} → colección ${Model.collection.name}`);
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (!Array.isArray(data) || data.length === 0) {
                console.warn(`⚠️  ${fileName} no contiene un array JSON válido, se omite.`);
                continue;
            }

            if (TRUNCATE) {
                await Model.deleteMany({});
                console.log(`🗑️  Colección ${Model.collection.name} vaciada`);
            }

            await Model.insertMany(data);
            console.log(`✅ Insertados ${data.length} documentos en ${Model.collection.name}`);
        }

        console.log('\n🎉 Carga finalizada');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error en loadDataMongo.js:', err);
        process.exit(1);
    }
}

main();
