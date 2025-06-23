const { Schema, model } = require('mongoose');

const RtCarAccessByDeviceSchema = new Schema({
  camera_id:           { type: String,           required: true },
  environmental_label: { type: Schema.Types.Mixed, required: true },
  count_vehicles:      { type: Number,           required: true },
  day_observed:        { type: Number,           required: true },
  vehicle_type:        { type: Schema.Types.Mixed, required: true },
  location: {
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null }
  }
}, {
  collection: 'rt_car_access_by_device',
  timestamps: false
});

module.exports = model('RtCarAccessByDevice', RtCarAccessByDeviceSchema);
