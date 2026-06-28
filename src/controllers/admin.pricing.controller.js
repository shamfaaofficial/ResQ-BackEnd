const asyncHandler = require('express-async-handler');
const PricingConfig = require('../models/PricingConfig');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { VEHICLE_TYPES } = require('../config/constants');

/**
 * GET - Get all pricing configurations
 */
exports.getAllPricingConfigs = asyncHandler(async (req, res) => {
  const configs = await PricingConfig.find().sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    data: {
      configs,
      total: configs.length
    }
  });
});

/**
 * GET - Get pricing configuration by vehicle type
 */
exports.getPricingConfigByVehicleType = asyncHandler(async (req, res) => {
  const { vehicleType } = req.params;

  // Validate vehicle type
  if (!Object.values(VEHICLE_TYPES).includes(vehicleType)) {
    throw new ValidationError('Invalid vehicle type');
  }

  const config = await PricingConfig.findOne({ vehicleType });

  if (!config) {
    throw new NotFoundError(`Pricing configuration not found for vehicle type: ${vehicleType}`);
  }

  res.status(200).json({
    success: true,
    data: { config }
  });
});

/**
 * PUT - Create or Update pricing configuration for a vehicle type
 */
exports.updatePricingConfig = asyncHandler(async (req, res) => {
  const { vehicleType } = req.params;
  const {
    basePrice,
    perKmRate,
    minimumFare,
    includedKm,
    serviceFeePercentage,
    driverCommissionPercentage,
    isActive
  } = req.body;

  // Validate vehicle type
  if (!Object.values(VEHICLE_TYPES).includes(vehicleType)) {
    throw new ValidationError('Invalid vehicle type');
  }

  // Validate required update fields
  if (basePrice === undefined || perKmRate === undefined || minimumFare === undefined) {
    throw new ValidationError('basePrice, perKmRate, and minimumFare are required');
  }

  if (basePrice < 0 || perKmRate < 0 || minimumFare < 0) {
    throw new ValidationError('Prices and rates cannot be negative');
  }

  if (includedKm !== undefined && includedKm < 0) {
    throw new ValidationError('includedKm cannot be negative');
  }

  if (serviceFeePercentage !== undefined && (serviceFeePercentage < 0 || serviceFeePercentage > 100)) {
    throw new ValidationError('serviceFeePercentage must be between 0 and 100');
  }

  if (driverCommissionPercentage !== undefined && (driverCommissionPercentage < 0 || driverCommissionPercentage > 100)) {
    throw new ValidationError('driverCommissionPercentage must be between 0 and 100');
  }

  const updateFields = {
    basePrice: parseFloat(basePrice),
    perKmRate: parseFloat(perKmRate),
    minimumFare: parseFloat(minimumFare),
    includedKm: includedKm !== undefined ? parseFloat(includedKm) : 23,
    driverCommissionPercentage: driverCommissionPercentage !== undefined ? parseFloat(driverCommissionPercentage) : 80
  };

  if (serviceFeePercentage !== undefined) {
    updateFields.serviceFeePercentage = parseFloat(serviceFeePercentage);
  }

  if (isActive !== undefined) {
    updateFields.isActive = isActive === true || isActive === 'true';
  }

  const config = await PricingConfig.findOneAndUpdate(
    { vehicleType },
    {
      vehicleType,
      ...updateFields
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: `Pricing configuration for ${vehicleType} updated successfully`,
    data: { config }
  });
});
