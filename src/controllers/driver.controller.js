const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Booking = require('../models/Booking');
const LocationHistory = require('../models/LocationHistory');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const redisService = require('../services/redis.service');
const { isRedisAvailable } = require('../config/redis');

// Get driver profile
exports.getDriverProfile = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId })
    .populate('userId', 'phoneNumber profile role isActive');

  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  res.status(200).json({
    success: true,
    data: { driver }
  });
});

// Update driver location
exports.updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, address, speed, heading, accuracy } = req.body;

  if (!latitude || !longitude) {
    throw new ValidationError('Latitude and longitude are required');
  }

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const lng = parseFloat(longitude);
  const lat = parseFloat(latitude);

  // REDIS LAYER: Store location in Redis (super fast)
  if (isRedisAvailable()) {
    await redisService.storeDriverLocation(driver._id, lng, lat, {
      address: address || driver.currentLocation.address,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0
    });
  }

  // MONGODB LAYER: Update only every 5 minutes (reduces DB load)
  const shouldSync = await redisService.shouldSyncToMongoDB(driver._id);

  if (shouldSync || !isRedisAvailable()) {
    // Update driver's current location in MongoDB
    driver.currentLocation = {
      type: 'Point',
      coordinates: [lng, lat],
      address: address || driver.currentLocation.address,
      lastUpdated: new Date()
    };
    driver.isLocationEnabled = true;
    await driver.save();
  }

  // Check if driver has active booking
  let activeBooking = null;

  if (isRedisAvailable()) {
    // Try to get from Redis cache first
    const cachedBookingId = await redisService.getActiveBooking(driver._id);
    if (cachedBookingId) {
      activeBooking = { _id: cachedBookingId };
    }
  }

  // If not in cache, query MongoDB
  if (!activeBooking) {
    activeBooking = await Booking.findOne({
      driverId: driver._id,
      status: { $in: ['accepted', 'driver_arrived', 'in_progress'] }
    });

    // Cache for future requests
    if (activeBooking && isRedisAvailable()) {
      await redisService.cacheActiveBooking(driver._id, activeBooking._id);
    }
  }

  // Save to location history if active trip
  if (activeBooking) {
    await LocationHistory.create({
      bookingId: activeBooking._id,
      driverId: driver._id,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0,
      timestamp: new Date()
    });
  }

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: {
        latitude: lat,
        longitude: lng,
        address: address || driver.currentLocation.address,
        lastUpdated: new Date()
      },
      activeBooking: activeBooking ? activeBooking._id : null,
      cached: isRedisAvailable()
    }
  });
});

// Toggle online status
exports.toggleOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;

  if (typeof isOnline !== 'boolean') {
    throw new ValidationError('isOnline must be a boolean value');
  }

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Check if driver is approved
  // TODO: Re-enable approval check later
  // if (driver.approvalStatus !== 'approved') {
  //   throw new AuthorizationError('Driver account must be approved to go online');
  // }

  // Check if location is enabled
  if (isOnline && !driver.isLocationEnabled) {
    throw new ValidationError('Please enable location to go online');
  }

  // Check if vehicle details are provided
  // TODO: Re-enable vehicle details check later
  // if (isOnline && !driver.vehicleDetails.vehicleType) {
  //   throw new ValidationError('Please complete vehicle details to go online');
  // }

  driver.isOnline = isOnline;
  await driver.save();

  // Update Redis when going offline - remove from geospatial index
  if (!isOnline && isRedisAvailable()) {
    await redisService.removeDriverLocation(driver._id);
    await redisService.removeActiveBooking(driver._id);
  }

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data: {
      isOnline: driver.isOnline
    }
  });
});

// Update vehicle details
exports.updateVehicleDetails = asyncHandler(async (req, res) => {
  const {
    vehicleType,
    vehicleNumber,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor
  } = req.body;

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Update vehicle details
  if (vehicleType) driver.vehicleDetails.vehicleType = vehicleType;
  if (vehicleNumber) driver.vehicleDetails.vehicleNumber = vehicleNumber;
  if (vehicleMake) driver.vehicleDetails.vehicleMake = vehicleMake;
  if (vehicleModel) driver.vehicleDetails.vehicleModel = vehicleModel;
  if (vehicleYear) driver.vehicleDetails.vehicleYear = vehicleYear;
  if (vehicleColor) driver.vehicleDetails.vehicleColor = vehicleColor;

  await driver.save();

  res.status(200).json({
    success: true,
    message: 'Vehicle details updated successfully',
    data: {
      vehicleDetails: driver.vehicleDetails
    }
  });
});

// Get driver earnings summary
exports.getEarnings = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  res.status(200).json({
    success: true,
    data: {
      earnings: driver.earnings
    }
  });
});

// Update bank details
exports.updateBankDetails = asyncHandler(async (req, res) => {
  const { accountHolderName, bankName, accountNumber, iban } = req.body;

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  if (accountHolderName) driver.bankDetails.accountHolderName = accountHolderName;
  if (bankName) driver.bankDetails.bankName = bankName;
  if (accountNumber) driver.bankDetails.accountNumber = accountNumber;
  if (iban) driver.bankDetails.iban = iban;

  await driver.save();

  res.status(200).json({
    success: true,
    message: 'Bank details updated successfully',
    data: {
      bankDetails: driver.bankDetails
    }
  });
});

module.exports = exports;
