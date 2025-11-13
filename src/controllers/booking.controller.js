const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const User = require('../models/User');
const PricingConfig = require('../models/PricingConfig');
const mapsService = require('../services/maps.service');
const notificationService = require('../services/notification.service');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { BOOKING_STATUS, BOOKING_REQUEST_TIMEOUT_SECONDS, PAYMENT_TIMEOUT_SECONDS } = require('../config/constants');
const redisService = require('../services/redis.service');
const { isRedisAvailable } = require('../config/redis');
const { emitBookingUpdate } = require('../config/socket');
const { emitToUser } = require('../services/socket.service');

/**
 * USER BOOKING APIS
 */

// Get nearby available drivers
exports.getNearbyDrivers = asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 10 } = req.query;

  if (!latitude || !longitude) {
    throw new ValidationError('Latitude and longitude are required');
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const radiusKm = parseFloat(radius);

  let nearbyDrivers = [];
  let source = 'mongodb'; // Track data source

  // TRY REDIS FIRST (100x faster)
  if (isRedisAvailable()) {
    try {
      const redisResults = await redisService.findNearbyDrivers(lng, lat, radiusKm, 20);

      if (redisResults && redisResults.length > 0) {
        // Get driver details from MongoDB for the nearby driver IDs
        const driverIds = redisResults.map(r => r.driverId);

        const drivers = await Driver.find({
          _id: { $in: driverIds },
          isOnline: true
          // Note: Removed approvalStatus check temporarily as per earlier request
        })
        .populate('userId', 'phoneNumber profile')
        .select('userId vehicleDetails currentLocation rating isOnline')
        .lean();

        // Map drivers with distance from Redis
        nearbyDrivers = drivers.map(driver => {
          const redisData = redisResults.find(r => r.driverId === driver._id.toString());
          return {
            id: driver._id,
            location: {
              latitude: driver.currentLocation.coordinates[1],
              longitude: driver.currentLocation.coordinates[0],
              address: driver.currentLocation.address
            },
            vehicleType: driver.vehicleDetails?.vehicleType,
            vehicleNumber: driver.vehicleDetails?.vehicleNumber,
            rating: driver.rating?.average || 0,
            totalRatings: driver.rating?.totalRatings || 0,
            distance: redisData ? redisData.distance : null
          };
        });

        // Sort by distance (closest first)
        nearbyDrivers.sort((a, b) => a.distance - b.distance);
        source = 'redis';
      }
    } catch (redisError) {
      console.error('[Booking] Redis query failed, falling back to MongoDB:', redisError.message);
      // Continue to MongoDB fallback
    }
  }

  // FALLBACK TO MONGODB if Redis unavailable or no results
  if (nearbyDrivers.length === 0) {
    try {
      const radiusInMeters = radiusKm * 1000;

      console.log(`[Booking] Querying MongoDB for drivers near [${lng}, ${lat}] within ${radiusKm}km`);

      const drivers = await Driver.find({
        isOnline: true,
        isLocationEnabled: true,
        // approvalStatus: 'approved', // Commented out as per earlier request
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance: radiusInMeters
          }
        }
      })
      .populate('userId', 'phoneNumber profile')
      .select('userId vehicleDetails currentLocation rating isOnline')
      .limit(20)
      .lean();

      console.log(`[Booking] Found ${drivers.length} nearby drivers in MongoDB`);

      nearbyDrivers = drivers.map(driver => ({
        id: driver._id,
        location: {
          latitude: driver.currentLocation.coordinates[1],
          longitude: driver.currentLocation.coordinates[0],
          address: driver.currentLocation.address
        },
        vehicleType: driver.vehicleDetails?.vehicleType,
        vehicleNumber: driver.vehicleDetails?.vehicleNumber,
        rating: driver.rating?.average || 0,
        totalRatings: driver.rating?.totalRatings || 0,
        distance: null
      }));
    } catch (mongoError) {
      console.error('[Booking] MongoDB geospatial query failed:', mongoError);
      // Return empty array instead of crashing
      nearbyDrivers = [];
    }
  }

  res.status(200).json({
    success: true,
    data: {
      drivers: nearbyDrivers,
      total: nearbyDrivers.length,
      source // 'redis' or 'mongodb' - useful for debugging
    }
  });
});

// Calculate price estimate
exports.getPriceEstimate = asyncHandler(async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.query;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new ValidationError('Pickup and dropoff locations are required');
  }

  // Calculate distance using Google Maps
  const distanceData = await mapsService.calculateDistance(
    { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
    { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng) }
  );

  const distanceInKm = distanceData.distance / 1000;

  // Static pricing: 110 QAR base + 10 QAR per km
  const basePrice = 110;
  const perKmRate = 10;
  const distancePrice = distanceInKm * perKmRate;
  const totalAmount = basePrice + distancePrice;

  res.status(200).json({
    success: true,
    message: 'Price calculated successfully',
    data: {
      distance: Math.round(distanceInKm * 10) / 10,
      estimatedDuration: Math.round(distanceData.duration / 60), // in minutes
      pricing: {
        basePrice: basePrice,
        perKmRate: perKmRate,
        distancePrice: Math.round(distancePrice * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        currency: 'QAR',
        breakdown: {
          base: `${basePrice} QAR (fixed)`,
          distance: `${Math.round(distanceInKm * 10) / 10} km × ${perKmRate} QAR/km = ${Math.round(distancePrice * 100) / 100} QAR`,
          total: `${Math.round(totalAmount * 100) / 100} QAR`
        }
      }
    }
  });
});

// Create booking request
exports.createBooking = asyncHandler(async (req, res) => {
  const {
    pickupLocation,
    dropoffLocation,
    vehicleType,
    notes
  } = req.body;

  // Validate required fields
  if (!pickupLocation?.coordinates || !dropoffLocation?.coordinates || !vehicleType) {
    throw new ValidationError('Pickup location, dropoff location, and vehicle type are required');
  }

  // Calculate distance
  const distanceData = await mapsService.calculateDistance(
    { lat: pickupLocation.coordinates[1], lng: pickupLocation.coordinates[0] },
    { lat: dropoffLocation.coordinates[1], lng: dropoffLocation.coordinates[0] }
  );

  const distanceInKm = distanceData.distance / 1000;

  // Static pricing: 110 QAR base + 10 QAR per km
  const basePrice = 110;
  const perKmRate = 10;
  const distancePrice = distanceInKm * perKmRate;
  const totalAmount = basePrice + distancePrice;

  // Generate booking number
  const bookingNumber = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Set expiry times
  const requestExpiresAt = new Date(Date.now() + BOOKING_REQUEST_TIMEOUT_SECONDS * 1000);

  // Create booking
  const booking = await Booking.create({
    bookingNumber,
    userId: req.userId,
    vehicleType,
    pickupLocation: {
      type: 'Point',
      coordinates: pickupLocation.coordinates,
      address: pickupLocation.address,
      placeName: pickupLocation.placeName
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: dropoffLocation.coordinates,
      address: dropoffLocation.address,
      placeName: dropoffLocation.placeName
    },
    distance: {
      estimated: distanceInKm
    },
    pricing: {
      basePrice: basePrice,
      perKmRate: perKmRate,
      totalDistance: distanceInKm,
      distancePrice: Math.round(distancePrice * 100) / 100,
      serviceFee: 0,
      totalAmount: Math.round(totalAmount * 100) / 100,
      currency: 'QAR'
    },
    status: BOOKING_STATUS.REQUESTED,
    requestExpiresAt,
    searchRadius: 10,
    notes
  });

  // Populate user details
  await booking.populate('userId', 'phoneNumber profile');

  res.status(201).json({
    success: true,
    message: 'Booking request created successfully',
    data: {
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        vehicleType: booking.vehicleType,
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        pricing: booking.pricing,
        expiresAt: booking.requestExpiresAt,
        createdAt: booking.createdAt
      }
    }
  });
});

// Get user's active booking
exports.getUserActiveBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    userId: req.userId,
    status: {
      $in: [
        BOOKING_STATUS.REQUESTED,
        BOOKING_STATUS.ACCEPTED,
        BOOKING_STATUS.DRIVER_ARRIVED,
        BOOKING_STATUS.IN_PROGRESS,
        BOOKING_STATUS.PAYMENT_COMPLETED
      ]
    }
  })
  .populate('userId', 'phoneNumber profile')
  .populate({
    path: 'driverId',
    populate: { path: 'userId', select: 'phoneNumber profile' }
  })
  .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      booking: booking || null
    }
  });
});

// Get booking status by ID (including cancelled bookings with payment info)
exports.getBookingStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  console.log('[GetBookingStatus] Fetching booking status for:', bookingId);

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  })
  .populate({
    path: 'driverId',
    populate: { path: 'userId', select: 'phoneNumber profile' }
  })
  .select('bookingNumber status payment timeline cancellationDetails driverId pricing');

  if (!booking) {
    console.log('[GetBookingStatus] ❌ Booking not found');
    throw new NotFoundError('Booking not found');
  }

  console.log('[GetBookingStatus] Booking status:', booking.status);
  console.log('[GetBookingStatus] Payment status from DB:', booking.payment.status);
  console.log('[GetBookingStatus] Full payment object:', JSON.stringify(booking.payment, null, 2));

  const responseData = {
    success: true,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: {
        status: booking.payment.status,
        method: booking.payment.method,
        paidAmount: booking.payment.paidAmount,
        paidAt: booking.payment.paidAt,
        failedAt: booking.payment.failedAt
      },
      cancellationDetails: booking.cancellationDetails || null,
      driver: booking.driverId ? {
        id: booking.driverId._id,
        name: booking.driverId.userId?.profile?.firstName || 'Driver',
        phoneNumber: booking.driverId.userId?.phoneNumber
      } : null,
      timeline: booking.timeline,
      pricing: booking.pricing
    }
  };

  console.log('[GetBookingStatus] Response payment status:', responseData.data.payment.status);

  res.status(200).json(responseData);
});

// Get live booking status with driver location and ETA (for user app)
exports.getBookingLiveStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  })
  .populate('userId', 'phoneNumber profile')
  .populate({
    path: 'driverId',
    populate: { path: 'userId', select: 'phoneNumber profile' }
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Only provide live updates for active bookings
  if (![BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.PAYMENT_COMPLETED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)) {
    return res.status(200).json({
      success: true,
      data: {
        booking: {
          id: booking._id,
          status: booking.status,
          message: 'Booking is not in active state'
        }
      }
    });
  }

  // Get driver details
  const driver = await Driver.findById(booking.driverId);
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Calculate ETA and distance if driver location is available
  let eta = null;
  let distanceToPickup = null;
  let driverLocation = null;

  if (driver.currentLocation?.coordinates) {
    driverLocation = {
      latitude: driver.currentLocation.coordinates[1],
      longitude: driver.currentLocation.coordinates[0],
      address: driver.currentLocation.address
    };

    // Calculate ETA to pickup if trip hasn't started yet
    if (booking.status !== BOOKING_STATUS.IN_PROGRESS && booking.status !== BOOKING_STATUS.COMPLETED) {
      try {
        const distanceData = await mapsService.calculateDriverToPickupDistance(
          driver.currentLocation,
          booking.pickupLocation
        );

        eta = distanceData.duration ? `${distanceData.duration} min` : distanceData.durationText;
        distanceToPickup = distanceData.distanceText;
      } catch (error) {
        console.error('[LiveStatus] Failed to calculate ETA:', error.message);
      }
    }
  }

  // Prepare driver info
  const driverInfo = {
    id: driver._id,
    name: driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
      ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
      : 'Driver',
    phoneNumber: driver.userId?.phoneNumber,
    profileImage: driver.userId?.profile?.profileImage,
    currentLocation: driverLocation,
    vehicleDetails: {
      vehicleType: driver.vehicleDetails?.vehicleType,
      vehicleNumber: driver.vehicleDetails?.vehicleNumber,
      vehicleColor: driver.vehicleDetails?.vehicleColor,
      vehicleMake: driver.vehicleDetails?.vehicleMake,
      vehicleModel: driver.vehicleDetails?.vehicleModel
    },
    rating: driver.rating?.average || 0,
    totalRatings: driver.rating?.totalRatings || 0
  };

  res.status(200).json({
    success: true,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      driver: driverInfo,
      eta: eta,
      distanceToPickup: distanceToPickup,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
      pricing: booking.pricing,
      timeline: booking.timeline,
      verificationCode: booking.verificationCode,
      lastUpdated: new Date()
    }
  });
});

// Get calculated price for booking (after driver arrives)
exports.getBookingPrice = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Only show calculated price if driver has arrived
  if (booking.status !== BOOKING_STATUS.DRIVER_ARRIVED && booking.status !== BOOKING_STATUS.PAYMENT_COMPLETED && booking.status !== BOOKING_STATUS.IN_PROGRESS && booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ValidationError('Price not yet calculated. Driver must arrive first.');
  }

  res.status(200).json({
    success: true,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      pricing: {
        basePrice: booking.pricing.basePrice,
        perKmRate: booking.pricing.perKmRate,
        actualDistance: Math.round(booking.distance.actual * 10) / 10,
        distancePrice: booking.pricing.distancePrice,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency
      },
      paymentExpiresAt: booking.paymentExpiresAt,
      timeline: {
        arrivedAt: booking.timeline.driverArrivedAt
      }
    }
  });
});

// Cancel booking by user
exports.cancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check if booking can be cancelled
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER].includes(booking.status)) {
    throw new ValidationError('Booking cannot be cancelled');
  }

  // IMPORTANT: Handle payment status based on cancellation
  const { PAYMENT_STATUS } = require('../config/constants');

  // If payment was completed, mark it for refund
  if (booking.payment.status === PAYMENT_STATUS.COMPLETED) {
    booking.payment.status = PAYMENT_STATUS.REFUNDED;
    booking.payment.refundStatus = 'pending';
    booking.payment.refundDate = new Date();
    booking.payment.refundAmount = booking.payment.paidAmount || booking.pricing.totalAmount;
  } else if (booking.payment.status === PAYMENT_STATUS.PENDING) {
    // If payment was pending, mark it as failed since user cancelled
    booking.payment.status = PAYMENT_STATUS.FAILED;
    booking.payment.failedAt = new Date();
  }
  // If already failed, keep it as failed

  booking.status = BOOKING_STATUS.CANCELLED_BY_USER;
  booking.cancellationDetails = {
    cancelledBy: 'user',
    reason: reason || 'No reason provided',
    cancelledAt: new Date()
  };
  booking.timeline.cancelledAt = new Date();
  await booking.save();

  // Notify driver if booking was already accepted
  if (booking.driverId) {
    try {
      const driver = await Driver.findById(booking.driverId).populate('userId', 'fcmToken');
      if (driver && driver.userId) {
        await notificationService.sendNotification(
          driver.userId._id,
          'Booking Cancelled',
          `User cancelled the booking. Reason: ${reason || 'No reason provided'}`,
          'booking_cancelled',
          { bookingId: booking._id, cancelledBy: 'user', reason: reason }
        );
      }
    } catch (notifError) {
      console.error('[CancelBooking] Failed to notify driver:', notifError.message);
    }
  }

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[CancelBooking] Failed to emit socket event:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: { booking }
  });
});

// Get user's booking history
exports.getUserBookingHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = { userId: req.userId };
  if (status) {
    query.status = status;
  }

  const bookings = await Booking.find(query)
    .populate('driverId', 'userId vehicleDetails rating')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * DRIVER BOOKING APIS
 */

// Get available booking requests for driver
exports.getAvailableBookings = asyncHandler(async (req, res) => {
  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Check if driver is approved and online
  if (driver.approvalStatus !== 'approved' || !driver.isOnline) {
    return res.status(200).json({
      success: true,
      data: { bookings: [] }
    });
  }

  const driverLocation = driver.currentLocation.coordinates;
  const searchRadius = 10000; // 10 km in meters

  // Find nearby booking requests
  const bookings = await Booking.find({
    status: BOOKING_STATUS.REQUESTED,
    vehicleType: driver.vehicleDetails.vehicleType,
    requestExpiresAt: { $gt: new Date() },
    'pickupLocation.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: driverLocation
        },
        $maxDistance: searchRadius
      }
    }
  })
  .populate('userId', 'phoneNumber profile')
  .sort({ createdAt: -1 })
  .limit(10);

  // Format bookings with enhanced details
  const formattedBookings = await Promise.all(bookings.map(async (booking) => {
    // Calculate driver to pickup distance
    let driverToPickup = null;
    if (driver.currentLocation?.coordinates) {
      try {
        const distance = await mapsService.calculateDriverToPickupDistance(
          driver.currentLocation,
          booking.pickupLocation
        );
        driverToPickup = {
          distance: distance.distance,
          distanceText: distance.distanceText,
          duration: distance.duration,
          durationText: distance.durationText
        };
      } catch (error) {
        console.error('[AvailableBookings] Failed to calculate distance:', error.message);
      }
    }

    return {
      id: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      vehicleType: booking.vehicleType,
      pickupLocation: booking.pickupLocation,
      vehicleDetails: booking.vehicleDetails,
      pricing: booking.pricing,
      distance: booking.distance,
      estimatedDuration: booking.estimatedDuration,
      requestExpiresAt: booking.requestExpiresAt,
      notes: booking.notes,
      createdAt: booking.createdAt,
      user: {
        id: booking.userId._id,
        phoneNumber: booking.userId.phoneNumber,
        name: booking.userId.profile?.firstName
          ? `${booking.userId.profile.firstName} ${booking.userId.profile.lastName || ''}`.trim()
          : 'User',
        profileImage: booking.userId.profile?.profileImage
      },
      driverToPickup: driverToPickup,
      // Time remaining before expiry (in seconds)
      timeRemaining: Math.max(0, Math.floor((new Date(booking.requestExpiresAt) - new Date()) / 1000))
    };
  }));

  res.status(200).json({
    success: true,
    message: 'Available booking requests fetched successfully',
    data: {
      bookings: formattedBookings,
      total: formattedBookings.length
    }
  });
});

// Get specific booking request details by ID (for driver app)
exports.getBookingDetailsById = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find the booking
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'phoneNumber profile')
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'phoneNumber profile' }
    });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check if this booking is relevant to this driver
  // Either: assigned to this driver OR it's a requested booking not yet assigned
  const isAssignedToDriver = booking.driverId && booking.driverId._id.toString() === driver._id.toString();
  const isOpenRequest = booking.status === BOOKING_STATUS.REQUESTED;

  if (!isAssignedToDriver && !isOpenRequest) {
    throw new ValidationError('This booking is not available to you');
  }

  // Prepare booking response
  const bookingResponse = booking.toObject();

  // Hide dropoff location until trip starts
  if (booking.status !== BOOKING_STATUS.IN_PROGRESS && booking.status !== BOOKING_STATUS.COMPLETED) {
    delete bookingResponse.dropoffLocation;
  }

  // Calculate distance from driver to pickup if booking is still REQUESTED
  let driverToPickupDistance = null;
  if (booking.status === BOOKING_STATUS.REQUESTED && driver.currentLocation?.coordinates) {
    try {
      const distance = await mapsService.calculateDriverToPickupDistance(
        driver.currentLocation,
        booking.pickupLocation
      );
      driverToPickupDistance = {
        distance: distance.distance,
        distanceText: distance.distanceText,
        duration: distance.duration,
        durationText: distance.durationText
      };
    } catch (error) {
      console.error('[GetBookingDetails] Failed to calculate driver distance:', error.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Booking details fetched successfully',
    data: {
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        vehicleType: booking.vehicleType,
        pickupLocation: booking.pickupLocation,
        dropoffLocation: bookingResponse.dropoffLocation, // Hidden if not started
        vehicleDetails: booking.vehicleDetails,
        pricing: booking.pricing,
        distance: booking.distance,
        estimatedDuration: booking.estimatedDuration,
        timeline: booking.timeline,
        requestExpiresAt: booking.requestExpiresAt,
        paymentExpiresAt: booking.paymentExpiresAt,
        notes: booking.notes,
        verificationCode: booking.verificationCode,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        // User details
        user: {
          id: booking.userId._id,
          phoneNumber: booking.userId.phoneNumber,
          name: booking.userId.profile?.firstName
            ? `${booking.userId.profile.firstName} ${booking.userId.profile.lastName || ''}`.trim()
            : 'User',
          profileImage: booking.userId.profile?.profileImage
        },
        // Driver to pickup info (if applicable)
        driverToPickup: driverToPickupDistance
      }
    }
  });
});

// Accept booking request
exports.acceptBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId })
    .populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find booking
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check if booking is still available
  if (booking.status !== BOOKING_STATUS.REQUESTED) {
    throw new ValidationError('Booking is no longer available');
  }

  if (booking.isExpired()) {
    throw new ValidationError('Booking request has expired');
  }

  // Accept booking
  booking.status = BOOKING_STATUS.ACCEPTED;
  booking.driverId = driver._id;
  booking.timeline.acceptedAt = new Date();

  // Set payment expiry after acceptance (user should pay within 5 minutes)
  booking.paymentExpiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_SECONDS * 1000);

  // ============================================================
  // AUTO-COMPLETE PAYMENT (TEMPORARY - FOR DEVELOPMENT/TESTING)
  // TODO: Remove this in production - payment should come from user
  // ============================================================
  booking.status = BOOKING_STATUS.PAYMENT_COMPLETED;
  booking.timeline.paymentCompletedAt = new Date();
  booking.payment = {
    status: 'completed',
    method: 'Auto-completed (Development)',
    gateway: 'N/A',
    paidAmount: booking.pricing.totalAmount,
    paidAt: new Date(),
    gatewayResponse: { note: 'Auto-completed for testing' }
  };

  await booking.save();

  await booking.populate('userId', 'phoneNumber profile fcmToken');

  // Send notification to user about booking acceptance
  const driverName = driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
    ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
    : driver.userId?.phoneNumber || 'Driver';

  try {
    await notificationService.notifyBookingAccepted(
      booking.userId._id,
      booking._id,
      driverName
    );
    console.log('[AcceptBooking] Booking acceptance notification sent to user');
  } catch (notifError) {
    console.error('[AcceptBooking] Failed to send notification to user:', notifError.message);
    // Don't fail the booking acceptance if notification fails
  }

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[AcceptBooking] Failed to emit socket event:', error.message);
  }

  // Prepare response without dropoff location (hidden until trip starts)
  const bookingResponse = booking.toObject();
  delete bookingResponse.dropoffLocation;

  res.status(200).json({
    success: true,
    message: 'Booking accepted and payment auto-completed (development mode)',
    data: {
      booking: bookingResponse,
      note: 'Payment auto-completed for testing. Driver can now navigate to pickup location.'
    }
  });
});

// Get driver's active booking
exports.getDriverActiveBooking = asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    driverId: driver._id,
    status: {
      $in: [
        BOOKING_STATUS.ACCEPTED,
        BOOKING_STATUS.DRIVER_ARRIVED,
        BOOKING_STATUS.IN_PROGRESS,
        BOOKING_STATUS.PAYMENT_COMPLETED
      ]
    }
  })
  .populate('userId', 'phoneNumber profile')
  .sort({ createdAt: -1 });

  if (!booking) {
    return res.status(200).json({
      success: true,
      data: { booking: null }
    });
  }

  // Hide dropoff location until trip starts (IN_PROGRESS status)
  const bookingResponse = booking.toObject();
  if (booking.status !== BOOKING_STATUS.IN_PROGRESS && booking.status !== BOOKING_STATUS.COMPLETED) {
    delete bookingResponse.dropoffLocation;
  }

  res.status(200).json({
    success: true,
    data: {
      booking: bookingResponse
    }
  });
});

// Mark driver arrived at pickup
exports.markDriverArrived = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const driver = await Driver.findOne({ userId: req.userId });
  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.status !== BOOKING_STATUS.PAYMENT_COMPLETED) {
    throw new ValidationError('Payment must be completed before driver can mark arrival');
  }

  // Generate 4-digit verification code
  const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

  booking.verificationCode = {
    code: verificationCode,
    generatedAt: new Date(),
    isVerified: false
  };

  booking.status = BOOKING_STATUS.DRIVER_ARRIVED;
  booking.timeline.driverArrivedAt = new Date();
  await booking.save();

  // Populate booking for response
  await booking.populate('userId', 'phoneNumber profile fcmToken');

  // Send notification to user with verification code
  await notificationService.sendNotification(
    booking.userId._id,
    'Driver Arrived',
    `Your driver has arrived! Your verification code is: ${verificationCode}`,
    'driver_arrived',
    { bookingId: booking._id, verificationCode }
  );

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[MarkDriverArrived] Failed to emit socket event:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Arrival confirmed. Verification code generated.',
    data: {
      booking,
      verificationCode: verificationCode
    }
  });
});

// Start trip
exports.startTrip = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const driver = await Driver.findOne({ userId: req.userId });
  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.status !== BOOKING_STATUS.DRIVER_ARRIVED) {
    throw new ValidationError('Driver must arrive at pickup before starting trip');
  }

  // Check if verification code is verified
  if (!booking.verificationCode?.isVerified) {
    throw new ValidationError('You must verify the pickup code before starting trip');
  }

  booking.status = BOOKING_STATUS.IN_PROGRESS;
  booking.timeline.startedAt = new Date();
  await booking.save();

  // Now reveal the full booking including dropoff location
  await booking.populate('userId', 'phoneNumber profile');

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[StartTrip] Failed to emit socket event:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Trip started - dropoff location now available',
    data: { booking }
  });
});

// Complete trip
exports.completeTrip = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { actualDropoffLocation } = req.body;

  const driver = await Driver.findOne({ userId: req.userId });
  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new ValidationError('Trip must be in progress to complete');
  }

  // Update actual dropoff location if provided
  if (actualDropoffLocation?.coordinates) {
    booking.actualDropoffLocation = {
      type: 'Point',
      coordinates: actualDropoffLocation.coordinates,
      address: actualDropoffLocation.address
    };

    // Calculate actual distance
    const actualDistanceData = await mapsService.calculateDistance(
      { lat: booking.pickupLocation.coordinates[1], lng: booking.pickupLocation.coordinates[0] },
      { lat: actualDropoffLocation.coordinates[1], lng: actualDropoffLocation.coordinates[0] }
    );
    booking.distance.actual = actualDistanceData.distance / 1000;
  }

  // Calculate driver earnings and platform commission
  const pricing = await PricingConfig.findOne({ vehicleType: booking.vehicleType });
  const commissionPercentage = pricing?.driverCommissionPercentage || 20;

  booking.platformCommission = (booking.pricing.totalAmount * commissionPercentage) / 100;
  booking.driverEarnings = booking.pricing.totalAmount - booking.platformCommission;

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.timeline.completedAt = new Date();
  await booking.save();

  // Update driver earnings
  driver.earnings.totalEarnings += booking.driverEarnings;
  driver.earnings.availableBalance += booking.driverEarnings;
  await driver.save();

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[CompleteTrip] Failed to emit socket event:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Trip completed successfully',
    data: {
      booking,
      earnings: booking.driverEarnings
    }
  });
});

// Cancel booking by driver
exports.cancelBookingByDriver = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  console.log('\n========== DRIVER CANCELLATION STARTED ==========');
  console.log('[CancelBookingByDriver] Booking ID:', bookingId);
  console.log('[CancelBookingByDriver] Cancellation reason:', reason);

  const driver = await Driver.findOne({ userId: req.userId });
  console.log('[CancelBookingByDriver] Driver ID:', driver?._id);

  // First, try to find booking assigned to this driver
  let booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  // If not found, check if this is a REQUESTED booking that driver wants to reject
  if (!booking) {
    console.log('[CancelBookingByDriver] Booking not found with driverId, checking for REQUESTED status...');
    booking = await Booking.findOne({
      _id: bookingId,
      status: BOOKING_STATUS.REQUESTED
    });

    if (booking) {
      console.log('[CancelBookingByDriver] Found REQUESTED booking - driver is rejecting before acceptance');
    }
  }

  if (!booking) {
    console.log('[CancelBookingByDriver] ❌ Booking not found or not accessible to this driver');
    throw new NotFoundError('Booking not found');
  }

  console.log('[CancelBookingByDriver] Current booking status:', booking.status);
  console.log('[CancelBookingByDriver] Current driverId:', booking.driverId);
  console.log('[CancelBookingByDriver] Current payment status:', booking.payment?.status);
  console.log('[CancelBookingByDriver] Payment details:', JSON.stringify(booking.payment, null, 2));

  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER].includes(booking.status)) {
    console.log('[CancelBookingByDriver] ❌ Booking cannot be cancelled - already in final state');
    throw new ValidationError('Booking cannot be cancelled');
  }

  // Special case: If booking is REQUESTED and has no driverId, this is a rejection before acceptance
  const isRejectionBeforeAcceptance = booking.status === BOOKING_STATUS.REQUESTED && !booking.driverId;
  console.log('[CancelBookingByDriver] Is rejection before acceptance?', isRejectionBeforeAcceptance);

  // IMPORTANT: Handle payment status based on cancellation
  const { PAYMENT_STATUS } = require('../config/constants');

  console.log('[CancelBookingByDriver] Checking payment status for refund handling...');
  console.log('[CancelBookingByDriver] PAYMENT_STATUS.COMPLETED:', PAYMENT_STATUS.COMPLETED);
  console.log('[CancelBookingByDriver] PAYMENT_STATUS.PENDING:', PAYMENT_STATUS.PENDING);
  console.log('[CancelBookingByDriver] PAYMENT_STATUS.FAILED:', PAYMENT_STATUS.FAILED);
  console.log('[CancelBookingByDriver] PAYMENT_STATUS.REFUNDED:', PAYMENT_STATUS.REFUNDED);
  console.log('[CancelBookingByDriver] Current booking.payment.status:', booking.payment.status);
  console.log('[CancelBookingByDriver] Type of booking.payment.status:', typeof booking.payment.status);
  console.log('[CancelBookingByDriver] Strict equality check (COMPLETED):', booking.payment.status === PAYMENT_STATUS.COMPLETED);
  console.log('[CancelBookingByDriver] Strict equality check (PENDING):', booking.payment.status === PAYMENT_STATUS.PENDING);
  console.log('[CancelBookingByDriver] Loose equality check (completed string):', booking.payment.status === 'completed');
  console.log('[CancelBookingByDriver] Loose equality check (pending string):', booking.payment.status === 'pending');

  // Handle payment status based on current state
  const currentPaymentStatus = booking.payment?.status || PAYMENT_STATUS.PENDING;

  switch (currentPaymentStatus) {
    case PAYMENT_STATUS.COMPLETED:
    case 'completed': // Fallback for string literal
      console.log('[CancelBookingByDriver] ✅ Payment was COMPLETED - marking for REFUND');
      booking.payment.status = PAYMENT_STATUS.REFUNDED;
      booking.payment.refundStatus = 'pending';
      booking.payment.refundDate = new Date();
      booking.payment.refundAmount = booking.payment.paidAmount || booking.pricing.totalAmount;
      console.log('[CancelBookingByDriver] Payment status updated to:', booking.payment.status);
      break;

    case PAYMENT_STATUS.PENDING:
    case 'pending': // Fallback for string literal
      console.log('[CancelBookingByDriver] ✅ Payment was PENDING - marking as FAILED');
      booking.payment.status = PAYMENT_STATUS.FAILED;
      booking.payment.failedAt = new Date();
      console.log('[CancelBookingByDriver] Payment status updated to:', booking.payment.status);
      break;

    case PAYMENT_STATUS.FAILED:
    case 'failed':
      console.log('[CancelBookingByDriver] ℹ️ Payment already FAILED - keeping status');
      break;

    case PAYMENT_STATUS.REFUNDED:
    case 'refunded':
      console.log('[CancelBookingByDriver] ℹ️ Payment already REFUNDED - keeping status');
      break;

    default:
      console.log('[CancelBookingByDriver] ⚠️ Unknown payment status:', currentPaymentStatus);
      // If payment status is unknown and booking was accepted, mark for refund to be safe
      if (booking.driverId) {
        console.log('[CancelBookingByDriver] ⚠️ Booking was accepted, defaulting to REFUNDED for safety');
        booking.payment.status = PAYMENT_STATUS.REFUNDED;
        booking.payment.refundStatus = 'pending';
        booking.payment.refundDate = new Date();
        booking.payment.refundAmount = booking.pricing.totalAmount;
      } else {
        console.log('[CancelBookingByDriver] ⚠️ Booking not accepted, defaulting to FAILED');
        booking.payment.status = PAYMENT_STATUS.FAILED;
        booking.payment.failedAt = new Date();
      }
      break;
  }

  console.log('[CancelBookingByDriver] Final payment status after switch:', booking.payment.status);

  booking.status = BOOKING_STATUS.CANCELLED_BY_DRIVER;
  booking.cancellationDetails = {
    cancelledBy: 'driver',
    reason: reason || 'No reason provided',
    cancelledAt: new Date()
  };
  booking.timeline.cancelledAt = new Date();

  console.log('[CancelBookingByDriver] Saving booking with updated status...');
  await booking.save();
  console.log('[CancelBookingByDriver] ✅ Booking saved successfully');
  console.log('[CancelBookingByDriver] Final booking status:', booking.status);
  console.log('[CancelBookingByDriver] Final payment status:', booking.payment.status);

  // Populate user details for notification
  console.log('[CancelBookingByDriver] Populating user details for notification...');
  await booking.populate('userId', 'phoneNumber profile fcmToken');
  console.log('[CancelBookingByDriver] User details populated - User ID:', booking.userId._id);

  // Send notification to user about cancellation
  if (booking.userId) {
    try {
      console.log('[CancelBookingByDriver] Sending cancellation notification to user...');
      await notificationService.sendNotification(
        booking.userId._id,
        'Booking Cancelled',
        `Driver cancelled your booking. Reason: ${reason || 'No reason provided'}`,
        'booking_cancelled',
        { bookingId: booking._id, cancelledBy: 'driver', reason: reason }
      );
      console.log('[CancelBookingByDriver] ✅ Notification sent successfully');
    } catch (notifError) {
      console.error('[CancelBookingByDriver] ❌ Failed to send notification:', notifError.message);
    }
  } else {
    console.log('[CancelBookingByDriver] ⚠️ No user found for notification');
  }

  // Emit Socket.IO event for real-time update
  try {
    console.log('[CancelBookingByDriver] Emitting socket event for booking update...');
    emitBookingUpdate(booking);
    console.log('[CancelBookingByDriver] ✅ Socket event emitted successfully');
  } catch (error) {
    console.error('[CancelBookingByDriver] ❌ Failed to emit socket event:', error.message);
  }

  console.log('[CancelBookingByDriver] Preparing response...');
  console.log('[CancelBookingByDriver] Response booking payment status:', booking.payment.status);
  console.log('[CancelBookingByDriver] Response booking status:', booking.status);
  console.log('[CancelBookingByDriver] Full booking.payment object:', JSON.stringify(booking.payment, null, 2));
  console.log('========== DRIVER CANCELLATION COMPLETED ==========\n');

  const responseData = {
    success: true,
    message: 'Booking cancelled successfully',
    data: { booking }
  };

  console.log('[CancelBookingByDriver] Response payment status in JSON:', responseData.data.booking.payment.status);

  res.status(200).json(responseData);
});

// Get driver's booking history
exports.getDriverBookingHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const query = { driverId: driver._id };
  if (status) {
    query.status = status;
  }

  const bookings = await Booking.find(query)
    .populate('userId', 'phoneNumber profile')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

// Request specific driver for tow service
exports.requestSpecificDriver = asyncHandler(async (req, res) => {
  const {
    driverId,
    vehicleType,
    pickupLocation,
    dropoffLocation,
    vehicleDetails,
    notes
  } = req.body;

  // Validate required fields
  if (!driverId || !pickupLocation?.coordinates || !dropoffLocation?.coordinates) {
    throw new ValidationError('Driver ID, pickup location, and dropoff location are required');
  }

  // Validate coordinates format
  if (!Array.isArray(pickupLocation.coordinates) || pickupLocation.coordinates.length !== 2 ||
      !Array.isArray(dropoffLocation.coordinates) || dropoffLocation.coordinates.length !== 2) {
    throw new ValidationError('Invalid coordinates format. Expected [longitude, latitude]');
  }

  // Find and validate driver
  const driver = await Driver.findById(driverId).populate('userId', 'phoneNumber profile fcmToken');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Check if driver has current location
  if (!driver.currentLocation?.coordinates || !Array.isArray(driver.currentLocation.coordinates)) {
    throw new ValidationError('Driver location is not available');
  }

  console.log('[RequestDriver] Calculating distances for booking...');
  console.log('[RequestDriver] Driver location:', driver.currentLocation.coordinates);
  console.log('[RequestDriver] Pickup location:', pickupLocation.coordinates);
  console.log('[RequestDriver] Dropoff location:', dropoffLocation.coordinates);

  // Calculate driver to pickup distance and ETA using Google Maps (with fallback)
  let driverToPickup;
  try {
    driverToPickup = await mapsService.calculateDriverToPickupDistance(
      driver.currentLocation,
      { type: 'Point', coordinates: pickupLocation.coordinates }
    );
    console.log('[RequestDriver] Driver to pickup distance calculated:', driverToPickup);
  } catch (error) {
    console.error('[RequestDriver] Failed to calculate driver to pickup distance:', error.message);
    throw new ValidationError(`Failed to calculate driver distance: ${error.message}`);
  }

  // Calculate trip route (pickup to dropoff) using Google Maps (with fallback)
  let tripRoute;
  try {
    tripRoute = await mapsService.calculateTripRoute(
      { type: 'Point', coordinates: pickupLocation.coordinates },
      { type: 'Point', coordinates: dropoffLocation.coordinates }
    );
    console.log('[RequestDriver] Trip route calculated:', tripRoute);
  } catch (error) {
    console.error('[RequestDriver] Failed to calculate trip route:', error.message);
    throw new ValidationError(`Failed to calculate trip route: ${error.message}`);
  }

  // Calculate pricing: 110 QAR base + 10 QAR per km
  const basePrice = 110;
  const perKmRate = 10;
  const distancePrice = tripRoute.distance * perKmRate;
  const totalAmount = basePrice + distancePrice;

  // Generate booking number
  const bookingNumber = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Set expiry times
  const requestExpiresAt = new Date(Date.now() + BOOKING_REQUEST_TIMEOUT_SECONDS * 1000);

  // Create booking
  const booking = await Booking.create({
    bookingNumber,
    userId: req.userId,
    driverId: driver._id,
    vehicleType,
    pickupLocation: {
      type: 'Point',
      coordinates: pickupLocation.coordinates,
      address: pickupLocation.address,
      placeName: pickupLocation.placeName
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: dropoffLocation.coordinates,
      address: dropoffLocation.address,
      placeName: dropoffLocation.placeName
    },
    vehicleDetails,
    distance: {
      estimated: tripRoute.distance,
      driverToPickup: driverToPickup.distance
    },
    pricing: {
      basePrice: basePrice,
      perKmRate: perKmRate,
      totalDistance: tripRoute.distance,
      distancePrice: Math.round(distancePrice * 100) / 100,
      serviceFee: 0,
      totalAmount: Math.round(totalAmount * 100) / 100,
      currency: 'QAR'
    },
    estimatedDuration: {
      driverToPickup: driverToPickup.duration,
      trip: tripRoute.duration
    },
    status: BOOKING_STATUS.REQUESTED,
    requestExpiresAt,
    notes
  });

  // Populate user and driver details
  await booking.populate([
    { path: 'userId', select: 'phoneNumber profile' },
    { path: 'driverId', populate: { path: 'userId', select: 'phoneNumber profile' } }
  ]);

  // Send notification to driver via Firebase (non-blocking - don't fail on notification error)
  try {
    await notificationService.notifyDriverNewBooking(
      driver._id,
      booking._id,
      pickupLocation.address || 'Pickup location',
      {
        eta: driverToPickup.duration,
        pricing: totalAmount,
        bookingNumber: booking.bookingNumber
      }
    );
    console.log('[RequestDriver] Notification sent to driver successfully');
  } catch (notificationError) {
    console.error('[RequestDriver] Failed to send notification to driver:', notificationError.message);
    // Don't fail the request if notification fails
  }

  // Emit socket event to driver for real-time notification
  try {
    emitToUser(driver._id, 'booking:new:request', {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      pickupLocation: {
        address: pickupLocation.address,
        coordinates: pickupLocation.coordinates
      },
      dropoffLocation: {
        address: dropoffLocation.address,
        coordinates: dropoffLocation.coordinates
      },
      vehicleType: booking.vehicleType,
      pricing: {
        total: totalAmount,
        basePrice: pricingConfig.basePrice,
        perKmRate: pricingConfig.perKmRate,
        distance: tripRoute.distance
      },
      eta: driverToPickup.duration,
      expiresAt: booking.requestExpiresAt,
      timestamp: new Date().toISOString()
    });
    console.log('[RequestDriver] Socket event emitted to driver:', driver._id);
  } catch (socketError) {
    console.error('[RequestDriver] Failed to emit socket event:', socketError.message);
    // Don't fail the request if socket emission fails
  }

  // Prepare response with driver info
  const driverName = driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
    ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
    : 'Driver';

  const driverArrivalText = driverToPickup.duration
    ? `${driverToPickup.duration} min (${driverToPickup.distanceText})`
    : driverToPickup.distanceText;

  const tripDurationText = tripRoute.duration
    ? `${tripRoute.duration} min (${tripRoute.distanceText})`
    : tripRoute.distanceText;

  res.status(201).json({
    success: true,
    message: 'Booking request sent to driver successfully',
    data: {
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        vehicleType: booking.vehicleType,
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        pricing: booking.pricing,
        driverInfo: {
          id: driver._id,
          name: driverName,
          phoneNumber: driver.userId.phoneNumber,
          vehicleNumber: driver.vehicleDetails?.vehicleNumber,
          rating: driver.rating?.average || 0
        },
        estimatedDuration: {
          driverArrival: driverArrivalText,
          tripDuration: tripDurationText
        },
        expiresAt: booking.requestExpiresAt,
        createdAt: booking.createdAt
      }
    }
  });
});
