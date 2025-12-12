const asyncHandler = require('express-async-handler');
const AdminSettings = require('../models/AdminSettings');
const { ValidationError } = require('../utils/errors');

/**
 * Get driver commission percentage
 */
exports.getDriverCommission = asyncHandler(async (req, res) => {
  const setting = await AdminSettings.findOne({ settingKey: 'driver_commission_percentage' });

  const percentage = setting?.settingValue || 25; // Default 25%

  res.status(200).json({
    success: true,
    data: {
      percentage: parseFloat(percentage),
      description: 'Percentage of total trip amount that goes to driver',
      updatedAt: setting?.updatedAt,
      updatedBy: setting?.updatedBy
    }
  });
});

/**
 * Update driver commission percentage
 */
exports.updateDriverCommission = asyncHandler(async (req, res) => {
  const { percentage } = req.body;

  // Validate percentage
  if (percentage === undefined || percentage === null) {
    throw new ValidationError('Percentage is required');
  }

  const percentageValue = parseFloat(percentage);

  if (isNaN(percentageValue)) {
    throw new ValidationError('Percentage must be a valid number');
  }

  if (percentageValue < 0 || percentageValue > 100) {
    throw new ValidationError('Percentage must be between 0 and 100');
  }

  // Update or create setting
  const setting = await AdminSettings.findOneAndUpdate(
    { settingKey: 'driver_commission_percentage' },
    {
      settingKey: 'driver_commission_percentage',
      settingValue: percentageValue,
      description: 'Percentage of total trip amount that goes to driver',
      updatedBy: req.userId
    },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    message: `Driver commission percentage updated to ${percentageValue}%`,
    data: {
      percentage: percentageValue,
      platformCommission: 100 - percentageValue,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy
    }
  });
});

/**
 * Get all admin settings
 */
exports.getAllSettings = asyncHandler(async (req, res) => {
  const settings = await AdminSettings.find()
    .populate('updatedBy', 'phoneNumber profile')
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      settings,
      total: settings.length
    }
  });
});

/**
 * Get a specific setting by key
 */
exports.getSettingByKey = asyncHandler(async (req, res) => {
  const { settingKey } = req.params;

  const setting = await AdminSettings.findOne({ settingKey })
    .populate('updatedBy', 'phoneNumber profile');

  if (!setting) {
    return res.status(404).json({
      success: false,
      error: 'Setting not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { setting }
  });
});

/**
 * Update or create a setting
 */
exports.updateSetting = asyncHandler(async (req, res) => {
  const { settingKey, settingValue, description } = req.body;

  if (!settingKey) {
    throw new ValidationError('Setting key is required');
  }

  if (settingValue === undefined || settingValue === null) {
    throw new ValidationError('Setting value is required');
  }

  const setting = await AdminSettings.findOneAndUpdate(
    { settingKey },
    {
      settingKey,
      settingValue,
      description,
      updatedBy: req.userId
    },
    { upsert: true, new: true }
  ).populate('updatedBy', 'phoneNumber profile');

  res.status(200).json({
    success: true,
    message: 'Setting updated successfully',
    data: { setting }
  });
});

/**
 * Delete a setting
 */
exports.deleteSetting = asyncHandler(async (req, res) => {
  const { settingKey } = req.params;

  const setting = await AdminSettings.findOneAndDelete({ settingKey });

  if (!setting) {
    return res.status(404).json({
      success: false,
      error: 'Setting not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Setting deleted successfully',
    data: { setting }
  });
});
