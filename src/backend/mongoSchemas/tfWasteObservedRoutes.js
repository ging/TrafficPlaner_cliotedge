const { Schema, model } = require('mongoose');

const TfWasteObservedRoutesSchema = new Schema({
  resource_id:            { type: Number, required: true },
  resource_code:          { type: String, required: true },
  resource_license_plate: { type: String, required: true },
  resource_brand:         { type: String, required: true },
  resource_model:         { type: String, required: true },
  resource_type:          { type: String, required: true },
  day_observed:           { type: Number, required: true },
  device_id:              { type: Number, required: true },
  distance:               { type: Number, required: true },
  speed:                  { type: Number, required: true },
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString'
    },
    coordinates: {
      type: [[Number]],
      default: []
    }
  }
}, {
  collection: 'tf_waste_observed_routes',
  timestamps: false
});


module.exports = model('TfWasteObservedRoutes', TfWasteObservedRoutesSchema);
