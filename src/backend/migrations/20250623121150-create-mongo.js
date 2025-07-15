const mongoose = require('../config/config.js');

async function up() {
  const db = mongoose.connection.db;

  // Índices para rt_car_access_by_device
  await db
    .collection('rt_car_access_by_device')
    .createIndex({ camera_id: 1 });
  await db
    .collection('rt_car_access_by_device')
    .createIndex({ day_observed: 1 });

  // Índices para rt_car_access
  await db
    .collection('rt_car_access')
    .createIndex({ device_id: 1 });
  await db
    .collection('rt_car_access')
    .createIndex({ timestamp: 1 });

  // Índices para tf_waste_weights
  await db
    .collection('tf_waste_weights')
    .createIndex({ date_observed_unix: 1 });

  // Índices para tf_waste_carbon_print
  await db
    .collection('tf_waste_carbon_print')
    .createIndex({ date_observed_unix: 1 });

  // Índices para tf_waste_observed_routes
  await db
    .collection('tf_waste_observed_routes')
    .createIndex({ route_id: 1 });
  await db
    .collection('tf_waste_observed_routes')
    .createIndex({ date_observed_unix: 1 });

  console.log('✅ Índices MongoDB creados correctamente');
  process.exit(0);
}

async function down() {
  const db = mongoose.connection.db;

  await db
    .collection('rt_car_access_by_device')
    .dropIndex('camera_id_1');
  await db
    .collection('rt_car_access_by_device')
    .dropIndex('day_observed_1');

  await db
    .collection('rt_car_access')
    .dropIndex('device_id_1');
  await db
    .collection('rt_car_access')
    .dropIndex('timestamp_1');

  await db
    .collection('tf_waste_weights')
    .dropIndex('date_observed_unix_1');

  await db
    .collection('tf_waste_carbon_print')
    .dropIndex('date_observed_unix_1');

  await db
    .collection('tf_waste_observed_routes')
    .dropIndex('route_id_1');
  await db
    .collection('tf_waste_observed_routes')
    .dropIndex('date_observed_unix_1');

  console.log('⛔️ Índices MongoDB eliminados');
  process.exit(0);
}

// Ejecutar la migración si se invoca directamente
if (require.main === module) {
  const [,, direction] = process.argv;
  if (direction === 'down') {
    down();
  } else {
    up();
  }
}

module.exports = { up, down };
