const { Schema, model } = require('mongoose');

const TfWasteCarbonPrintSchema = new Schema({
  resource_id:            { type: Number, required: true },
  resource_code:          { type: String, required: true },
  resource_license_plate: { type: String, required: true },
  resource_brand:         { type: String, required: true },
  resource_model:         { type: String, required: true },
  resource_type:          { type: String, required: true },
  resource_classification:{ type: String },
  day_observed:           { type: Number, required: true },
  device_id:              { type: Number, required: true },
  distance:               { type: Number, required: true },
  speed:                  { type: Number, required: true },
  carbon_per_km:          { type: Number },
  carbon_print:           { type: Number },
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
  collection: 'tf_waste_carbon_print',
  timestamps: false
});

// Si vas a hacer consultas geoespaciales:
// TfWasteCarbonPrintSchema.index({ geometry: '2dsphere' });

module.exports = model('TfWasteCarbonPrint', TfWasteCarbonPrintSchema);

