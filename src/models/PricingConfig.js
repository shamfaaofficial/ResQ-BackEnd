const mongoose = require('mongoose');
const { VEHICLE_TYPES } = require('../config/constants');

const pricingConfigSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: Object.values(VEHICLE_TYPES),
    required: true,
    unique: true
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  perKmRate: {
    type: Number,
    required: true,
    min: 0
  },
  minimumFare: {
    type: Number,
    required: true,
    min: 0
  },
  serviceFeePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  driverCommissionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

pricingConfigSchema.index({ vehicleType: 1 });
pricingConfigSchema.index({ isActive: 1 });

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
