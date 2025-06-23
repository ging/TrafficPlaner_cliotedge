const { Schema, model } = require('mongoose');

const RtCarAccessSchema = new Schema({
  environmental_label: { type: Schema.Types.Mixed, required: true },
  count_vehicles:      { type: Number,           required: true },
  day_observed:        { type: Number,           required: true },
  vehicle_type:        { type: Schema.Types.Mixed, required: true },
}, {
  collection: 'rt_car_access',
  timestamps: false
});

module.exports = model('RtCarAccess', RtCarAccessSchema);
