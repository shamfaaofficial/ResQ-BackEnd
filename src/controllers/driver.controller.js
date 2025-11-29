const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Booking = require('../models/Booking');
const LocationHistory = require('../models/LocationHistory');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const redisService = require('../services/redis.service');
const { isRedisAvailable } = require('../config/redis');
const { getIO } = require('../config/socket');
const mapsService = require('../services/maps.service');

// Get driver profile
exports.getDriverProfile = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId })
    .populate('userId', 'phoneNumber profile role isActive');

  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Generate signed URL for profile picture if it exists
  let profilePictureSignedUrl = null;
  if (driver.userId && driver.userId.profile && driver.userId.profile.profileImage) {
    try {
      const { extractS3Key, getSignedFileUrl } = require('../config/s3');
      const s3Key = extractS3Key(driver.userId.profile.profileImage);
      profilePictureSignedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
    } catch (error) {
      console.error('Failed to generate signed URL for profile picture:', error);
    }
  }

  // Add signed URL to response
  const driverData = driver.toObject();
  if (driverData.userId && driverData.userId.profile) {
    driverData.userId.profile.profileImageSignedUrl = profilePictureSignedUrl;
  }

  res.status(200).json({
    success: true,
    data: { driver: driverData }
  });
});

// Upload or update driver profile picture
exports.uploadProfilePicture = asyncHandler(async (req, res) => {
  const { uploadToS3, deleteFromS3, extractS3Key, getSignedFileUrl } = require('../config/s3');
  const path = require('path');

  // Check if file was uploaded
  if (!req.file) {
    throw new ValidationError('No image file uploaded');
  }

  // Get user
  const user = await User.findById(req.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Delete old profile picture from S3 if exists
  if (user.profile && user.profile.profileImage) {
    try {
      const oldS3Key = extractS3Key(user.profile.profileImage);
      await deleteFromS3(oldS3Key);
      console.log('Old profile picture deleted from S3');
    } catch (error) {
      console.error('Failed to delete old profile picture:', error);
      // Continue even if deletion fails
    }
  }

  // Generate unique filename for profile picture
  const fileExtension = path.extname(req.file.originalname);
  const s3FileName = `drivers/${driver._id}/profile_picture_${Date.now()}${fileExtension}`;

  // Upload to S3
  const s3Url = await uploadToS3(req.file.buffer, s3FileName, req.file.mimetype);

  // Update user profile with new image URL
  if (!user.profile) {
    user.profile = {};
  }
  user.profile.profileImage = s3Url;
  await user.save();

  // Generate signed URL for response
  const signedUrl = await getSignedFileUrl(s3FileName, 3600);

  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: {
      profileImage: s3Url,
      profileImageSignedUrl: signedUrl,
      uploadedAt: new Date()
    }
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

  // MONGODB LAYER: Always update location in MongoDB for geospatial queries
  // (Redis is used for real-time tracking, MongoDB for driver discovery)
  driver.currentLocation = {
    type: 'Point',
    coordinates: [lng, lat],
    address: address || driver.currentLocation.address,
    lastUpdated: new Date()
  };
  driver.isLocationEnabled = true;
  await driver.save();

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

    // Broadcast location update to user via Socket.IO
    try {
      const io = getIO();

      // Get full booking details to find user
      const booking = await Booking.findById(activeBooking._id).select('userId pickupLocation status');

      if (booking && booking.userId) {
        // Calculate ETA to pickup if not yet arrived
        let eta = null;
        let distanceToPickup = null;

        if (['accepted', 'payment_completed'].includes(booking.status)) {
          try {
            const distanceData = await mapsService.calculateDriverToPickupDistance(
              { type: 'Point', coordinates: [lng, lat] },
              booking.pickupLocation
            );
            eta = distanceData.duration ? `${distanceData.duration} min` : distanceData.durationText;
            distanceToPickup = distanceData.distanceText;
          } catch (error) {
            console.error('[LocationUpdate] Failed to calculate ETA:', error.message);
          }
        }

        // Emit to user's personal room
        io.to(`user:${booking.userId}`).emit('driver:location', {
          bookingId: activeBooking._id,
          location: {
            latitude: lat,
            longitude: lng,
            address: address || driver.currentLocation.address
          },
          eta: eta,
          distanceToPickup: distanceToPickup,
          speed: speed || 0,
          heading: heading || 0,
          timestamp: new Date()
        });

        console.log(`📍 [Location] Broadcasted driver ${driver._id} location to user ${booking.userId}`);
      }
    } catch (socketError) {
      console.error('[LocationUpdate] Socket.IO broadcast failed:', socketError.message);
      // Don't fail the request if socket broadcast fails
    }
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
  const { isOnline, latitude, longitude, address } = req.body;

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

  // If going online, check/update location
  if (isOnline) {
    // If location provided in request, update it
    if (latitude && longitude) {
      const lng = parseFloat(longitude);
      const lat = parseFloat(latitude);

      driver.currentLocation = {
        type: 'Point',
        coordinates: [lng, lat],
        address: address || driver.currentLocation.address || '',
        lastUpdated: new Date()
      };
      driver.isLocationEnabled = true;

      // Store in Redis if available
      if (isRedisAvailable()) {
        await redisService.storeDriverLocation(driver._id, lng, lat, {
          address: address || driver.currentLocation.address || '',
          speed: 0,
          heading: 0,
          accuracy: 0
        });
      }
    } else if (!driver.isLocationEnabled) {
      // No location provided and no location enabled
      throw new ValidationError('Please enable location to go online');
    }
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
      isOnline: driver.isOnline,
      location: isOnline && driver.currentLocation ? {
        latitude: driver.currentLocation.coordinates[1],
        longitude: driver.currentLocation.coordinates[0],
        address: driver.currentLocation.address
      } : null
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

// Get active trip
exports.getActiveTrip = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const { BOOKING_STATUS } = require('../config/constants');

  // Check Redis cache first
  let activeBooking = null;

  if (isRedisAvailable()) {
    const cachedBookingId = await redisService.getActiveBooking(driver._id);
    if (cachedBookingId) {
      const cachedBooking = await Booking.findById(cachedBookingId)
        .populate('userId', 'phoneNumber profile')
        .select('-__v');

      // CRITICAL: Validate cached booking is still active
      if (cachedBooking && [
        BOOKING_STATUS.ACCEPTED,
        BOOKING_STATUS.PAYMENT_COMPLETED,
        BOOKING_STATUS.DRIVER_ARRIVED,
        BOOKING_STATUS.IN_PROGRESS
      ].includes(cachedBooking.status)) {
        activeBooking = cachedBooking;
      } else {
        // Booking completed/cancelled - clear stale cache
        console.log('[GetActiveTrip] Clearing stale Redis cache for driver:', driver._id);
        await redisService.clearActiveBooking(driver._id);
      }
    }
  }

  // If not in cache or cache was invalid, query MongoDB
  if (!activeBooking) {
    activeBooking = await Booking.findOne({
      driverId: driver._id,
      status: {
        $in: [
          BOOKING_STATUS.ACCEPTED,
          BOOKING_STATUS.PAYMENT_COMPLETED,
          BOOKING_STATUS.DRIVER_ARRIVED,
          BOOKING_STATUS.IN_PROGRESS
        ]
      }
    })
      .populate('userId', 'phoneNumber profile')
      .select('-__v')
      .sort({ createdAt: -1 }); // Get latest if multiple exist

    // Cache for future requests
    if (activeBooking && isRedisAvailable()) {
      await redisService.cacheActiveBooking(driver._id, activeBooking._id);
    } else if (!activeBooking && isRedisAvailable()) {
      // No active booking - ensure cache is cleared
      await redisService.clearActiveBooking(driver._id);
    }
  }

  if (!activeBooking) {
    return res.status(200).json({
      success: true,
      message: 'No active trip found',
      data: {
        activeTrip: null
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      activeTrip: activeBooking
    }
  });
});

// Get driver ride history
exports.getRideHistory = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const { BOOKING_STATUS, PAGINATION } = require('../config/constants');

  // Query parameters
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Validate pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(parseInt(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Build query
  const query = { driverId: driver._id };

  // Filter by status (completed, cancelled_by_user, cancelled_by_driver)
  if (status) {
    // Allow filtering by specific status or multiple statuses
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else if (status === 'completed') {
      query.status = BOOKING_STATUS.COMPLETED;
    } else if (status === 'cancelled') {
      query.status = {
        $in: [BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED]
      };
    } else {
      query.status = status;
    }
  } else {
    // Default: Show only completed and cancelled trips (not active trips)
    query.status = {
      $in: [
        BOOKING_STATUS.COMPLETED,
        BOOKING_STATUS.CANCELLED_BY_USER,
        BOOKING_STATUS.CANCELLED_BY_DRIVER
      ]
    };
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      // Include the entire end date (set to end of day)
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDateTime;
    }
  }

  // Sort configuration
  const sortConfig = {};
  const validSortFields = ['createdAt', 'completedAt', 'totalAmount', 'driverEarnings'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

  // Map sortBy to actual field paths
  const sortFieldMap = {
    'createdAt': 'createdAt',
    'completedAt': 'timeline.completedAt',
    'totalAmount': 'pricing.totalAmount',
    'driverEarnings': 'driverEarnings'
  };

  sortConfig[sortFieldMap[sortField]] = sortOrder === 'asc' ? 1 : -1;

  // Execute queries in parallel
  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .populate('userId', 'phoneNumber profile')
      .select('-__v -verificationCode')
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query)
  ]);

  // Calculate statistics
  const stats = await Booking.aggregate([
    { $match: { driverId: driver._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalEarnings: {
          $sum: {
            $cond: [
              { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
              '$driverEarnings',
              0
            ]
          }
        }
      }
    }
  ]);

  // Format stats
  const statistics = {
    totalCompleted: stats.find(s => s._id === BOOKING_STATUS.COMPLETED)?.count || 0,
    totalCancelled: (
      (stats.find(s => s._id === BOOKING_STATUS.CANCELLED_BY_USER)?.count || 0) +
      (stats.find(s => s._id === BOOKING_STATUS.CANCELLED_BY_DRIVER)?.count || 0)
    ),
    totalEarnings: stats.find(s => s._id === BOOKING_STATUS.COMPLETED)?.totalEarnings || 0,
    totalTrips: stats.reduce((sum, s) => sum + s.count, 0)
  };

  res.status(200).json({
    success: true,
    data: {
      rides: bookings,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        recordsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPreviousPage: pageNum > 1
      },
      statistics
    }
  });
});

module.exports = exports;
