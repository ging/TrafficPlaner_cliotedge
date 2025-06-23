const { Schema, model } = require('mongoose');

const TfWasteWeightsSchema = new Schema({
  country:                       { type: String,  required: true },
  province:                      { type: String,  required: true },
  municipality:                  { type: String,  required: true },
  neighbourhood:                 { type: String },
  postal_code:                   { type: String },
  collection_point_id:           { type: Number,  required: true },
  collection_point_reference:    { type: String },
  collection_point_creation_date_utc: { type: Number, required: true },
  date_observed_utc:             { type: Number,  required: true },
  date_observed_local:           { type: Number,  required: true },
  day_observed:                  { type: Number,  required: true },
  hour_observed:                 { type: Number,  required: true },
  day_of_week_es:                { type: String,  required: true },
  month_es:                      { type: String,  required: true },
  waste_type:                    { type: String,  required: true },
  waste_weight:                  { type: Number,  required: true },
  resource_id:                   { type: Number,  required: true },
  resource_code:                 { type: String,  required: true },
  resource_type:                 { type: String,  required: true },
  resource_license_plate:        { type: String,  required: true },
  device_id:                     { type: Number,  required: true },
  latitude:                      { type: Number,  required: true },
  longitude:                     { type: Number,  required: true },
  altitude:                      { type: Number },
  is_payt:                       { type: Boolean, required: true },
  observations:                  { type: String }
}, {
  collection: 'tf_waste_weights',
  timestamps: false
});

module.exports = model('TfWasteWeights', TfWasteWeightsSchema);
