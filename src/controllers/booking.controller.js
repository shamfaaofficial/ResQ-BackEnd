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
const { calculateDistance } = require('../utils/helpers');

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
          isOnline: true,
          isBusy: false
          // Note: Removed approvalStatus check temporarily as per earlier request
        })
          .populate('userId', 'phoneNumber profile')
          .select('userId vehicleDetails currentLocation rating isOnline')
          .lean();

        // Map drivers with distance from Redis
        nearbyDrivers = drivers.map(driver => {
          const redisData = redisResults.find(r => r.driverId === driver._id.toString());
          // Redis returns distance in meters, convert to km
          const distanceInKm = redisData ? parseFloat((redisData.distance / 1000).toFixed(2)) : null;

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
            distanceKm: distanceInKm,
            name: driver.userId?.profile?.firstName
              ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName || ''}`.trim()
              : 'Driver'
          };
        });

        // Sort by distance (closest first)
        nearbyDrivers.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
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
        isBusy: false,
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

      nearbyDrivers = drivers.map(driver => {
        // Calculate distance using Haversine formula
        const distanceInKm = calculateDistance(
          lat,
          lng,
          driver.currentLocation.coordinates[1],
          driver.currentLocation.coordinates[0]
        );

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
          distanceKm: distanceInKm,
          name: driver.userId?.profile?.firstName
            ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName || ''}`.trim()
            : 'Driver'
        };
      });
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

  // Pricing: 10 QAR per km, base price 110 (switches to 0 if distance >= 110)
  const minimumCharge = 110;
  const perKmRate = 10;
  const distancePrice = distanceInKm * perKmRate;
  // Base price: 110 if distance < 110, else 0
  const basePrice = distancePrice >= minimumCharge ? 0 : minimumCharge;
  // Total: base + distance
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
          base: basePrice > 0 ? `${basePrice} QAR (minimum charge)` : '0 QAR (distance exceeds minimum)',
          distance: `${Math.round(distanceInKm * 10) / 10} km × ${perKmRate} QAR/km = ${Math.round(distancePrice * 100) / 100} QAR`,
          total: `${basePrice} QAR + ${Math.round(distancePrice * 100) / 100} QAR = ${Math.round(totalAmount * 100) / 100} QAR`
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

  // Check if user already has an active booking
  const activeBooking = await Booking.findOne({
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
  });

  if (activeBooking) {
    throw new ValidationError('You already have an active booking. Please complete or cancel it first.');
  }

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

  // Pricing: 10 QAR per km, base price 110 (switches to 0 if distance >= 110)
  const minimumCharge = 110;
  const perKmRate = 10;
  const distancePrice = distanceInKm * perKmRate;
  // Base price: 110 if distance < 110, else 0
  const basePrice = distancePrice >= minimumCharge ? 0 : minimumCharge;
  // Total: base + distance
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
  console.log('\n========== GET USER ACTIVE BOOKING ==========');
  console.log('[GetUserActiveBooking] User ID:', req.userId);
  console.log('[GetUserActiveBooking] Timestamp:', new Date().toISOString());

  // First, let's see ALL bookings for this user to debug
  const allUserBookings = await Booking.find({ userId: req.userId })
    .select('bookingNumber status payment.status createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  console.log('[GetUserActiveBooking] Last 5 bookings for this user:');
  console.log(JSON.stringify(allUserBookings, null, 2));

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

  if (booking) {
    console.log('[GetUserActiveBooking] ✅ Found active booking:', booking.bookingNumber);
    console.log('[GetUserActiveBooking] Booking status:', booking.status);
    console.log('[GetUserActiveBooking] Payment status:', booking.payment?.status);
  } else {
    console.log('[GetUserActiveBooking] ❌ No active booking found');
    console.log('[GetUserActiveBooking] Query statuses:', [
      BOOKING_STATUS.REQUESTED,
      BOOKING_STATUS.ACCEPTED,
      BOOKING_STATUS.DRIVER_ARRIVED,
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.PAYMENT_COMPLETED
    ]);
  }
  console.log('========== END GET USER ACTIVE BOOKING ==========\n');

  // ============== PAYMENT FLOW HANDLING ==============
  const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../config/constants');

  // Determine if we should show full details or minimal details
  // 1. If still REQUESTED, show minimal (searching for driver)
  // 2. If ONLINE payment and PENDING, show minimal (waiting for payment)
  // 3. If CASH payment, show full details (pay at end)

  const isRequested = booking && booking.status === BOOKING_STATUS.REQUESTED;
  const isOnlinePaymentPending = booking &&
    booking.payment?.method === PAYMENT_METHOD.ONLINE &&
    booking.payment?.status !== PAYMENT_STATUS.COMPLETED;

  if (isRequested || isOnlinePaymentPending) {
    if (isRequested) {
      console.log('[GetUserActiveBooking] 🔍 Booking in REQUESTED status - waiting for driver');
    } else {
      console.log('[GetUserActiveBooking] 💳 Online payment PENDING - waiting for payment');
    }

    // Prepare minimal response
    const minimalResponse = {
      id: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      pickupLocation: {
        latitude: booking.pickupLocation.coordinates[1],
        longitude: booking.pickupLocation.coordinates[0],
        address: booking.pickupLocation.address,
        placeName: booking.pickupLocation.placeName
      },
      dropoffLocation: {
        latitude: booking.dropoffLocation.coordinates[1],
        longitude: booking.dropoffLocation.coordinates[0],
        address: booking.dropoffLocation.address,
        placeName: booking.dropoffLocation.placeName
      },
      pricing: booking.pricing,
      paymentMethod: booking.payment?.method || 'cash',
      paymentStatus: booking.payment?.status,
      paymentUrl: booking.payment?.paymentUrl,
      paymentExpiresAt: booking.paymentExpiresAt,
      message: isRequested ? 'Searching for a driver...' : 'Please complete payment to view trip details',
      needsPayment: isOnlinePaymentPending
    };

    return res.status(200).json({
      success: true,
      data: {
        booking: minimalResponse,
        driverCurrentLocation: null
      }
    });
  }

  // Driver accepted - return full trip details with driver info
  console.log('[GetUserActiveBooking] 💵 Cash payment flow - returning full trip details');
  console.log('[GetUserActiveBooking] Booking status:', booking?.status);
  console.log('[GetUserActiveBooking] Payment method:', booking?.payment?.method);

  // If booking exists with driver, fetch real-time driver location and generate signed URL for profile image
  let driverCurrentLocation = null;
  if (booking && booking.driverId) {
    const driver = await Driver.findById(booking.driverId._id).select('currentLocation');
    if (driver && driver.currentLocation?.coordinates) {
      driverCurrentLocation = {
        latitude: driver.currentLocation.coordinates[1],
        longitude: driver.currentLocation.coordinates[0],
        address: driver.currentLocation.address,
        lastUpdated: driver.currentLocation.lastUpdated
      };
    }

    // Generate signed URL for driver profile image if it's an S3 URL
    if (booking.driverId.userId?.profile?.profileImage) {
      const profileImageUrl = booking.driverId.userId.profile.profileImage;
      if (profileImageUrl.includes('s3.') && profileImageUrl.includes('amazonaws.com')) {
        try {
          const { getSignedFileUrl, extractS3Key } = require('../config/s3');
          const s3Key = extractS3Key(profileImageUrl);
          const signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
          booking.driverId.userId.profile.profileImage = signedUrl;
          console.log(`[GetUserActiveBooking] Generated signed URL for driver profile image`);
        } catch (error) {
          console.error(`[GetUserActiveBooking] Failed to generate signed URL:`, error.message);
        }
      }
    }
  }

  // Transform booking to ensure consistent location format with address
  const formattedBooking = booking ? {
    ...booking.toObject(),
    pickupLocation: {
      latitude: booking.pickupLocation.coordinates[1],
      longitude: booking.pickupLocation.coordinates[0],
      address: booking.pickupLocation.address,
      placeName: booking.pickupLocation.placeName
    },
    dropoffLocation: {
      latitude: booking.dropoffLocation.coordinates[1],
      longitude: booking.dropoffLocation.coordinates[0],
      address: booking.dropoffLocation.address,
      placeName: booking.dropoffLocation.placeName
    },
    // Add cash payment info for user
    paymentMethod: booking.payment?.method || 'cash',
    cashPaymentRequired: booking.payment?.method === 'cash' && booking.payment?.status !== 'completed',
    amountToPay: booking.pricing?.totalAmount
  } : null;

  res.status(200).json({
    success: true,
    data: {
      booking: formattedBooking,
      driverCurrentLocation: driverCurrentLocation  // Real-time driver location
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

  // CRITICAL: Only return driver details if payment is completed
  const { PAYMENT_STATUS } = require('../config/constants');
  const isPaymentCompleted = booking.payment?.status === PAYMENT_STATUS.COMPLETED;

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
      // Only return driver details if payment is completed
      driver: (isPaymentCompleted && booking.driverId) ? {
        id: booking.driverId._id,
        name: booking.driverId.userId?.profile?.firstName || 'Driver',
        phoneNumber: booking.driverId.userId?.phoneNumber
      } : null,
      timeline: booking.timeline,
      pricing: booking.pricing,
      needsPayment: !isPaymentCompleted
    }
  };

  console.log('[GetBookingStatus] Response payment status:', responseData.data.payment.status);
  console.log('[GetBookingStatus] Driver details included:', !!responseData.data.driver);

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

  // Provide live updates for active bookings and show details for completed bookings
  if (![BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.PAYMENT_COMPLETED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
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

  // ============== PAYMENT FLOW HANDLING ==============
  const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../config/constants');

  // If usage is online payment and pending, don't show live driver location
  // For CASH payment, we show full details immediately
  const isOnlinePaymentPending = booking.payment?.method === PAYMENT_METHOD.ONLINE &&
    booking.payment?.status !== PAYMENT_STATUS.COMPLETED;

  if (isOnlinePaymentPending) {
    console.log('[GetBookingLiveStatus] 💳 Online payment PENDING - returning minimal details');

    return res.status(200).json({
      success: true,
      data: {
        booking: {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          status: booking.status,
          paymentStatus: booking.payment?.status || PAYMENT_STATUS.PENDING,
          paymentUrl: booking.payment?.paymentUrl || null,
          paymentExpiresAt: booking.paymentExpiresAt,
          pricing: booking.pricing,
          message: 'Please complete payment to view trip details',
          needsPayment: true
        },
        driver: null,
        eta: null,
        distanceToPickup: null
      }
    });
  }

  console.log('[GetBookingLiveStatus] ✅ Payment verified or Cash flow - showing full trip details');

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

  // Generate signed URL for driver profile image if it's an S3 URL
  let driverProfileImage = driver.userId?.profile?.profileImage;
  if (driverProfileImage && driverProfileImage.includes('s3.') && driverProfileImage.includes('amazonaws.com')) {
    try {
      const { getSignedFileUrl, extractS3Key } = require('../config/s3');
      const s3Key = extractS3Key(driverProfileImage);
      const signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
      driverProfileImage = signedUrl;
      console.log(`[GetBookingLiveStatus] Generated signed URL for driver profile image`);
    } catch (error) {
      console.error(`[GetBookingLiveStatus] Failed to generate signed URL:`, error.message);
      // Keep original URL if signing fails
    }
  }

  // Prepare driver info
  const driverInfo = {
    id: driver._id,
    name: driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
      ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
      : 'Driver',
    phoneNumber: driver.userId?.phoneNumber,
    profileImage: driverProfileImage,
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

  // Log verification code status
  console.log(`[LiveStatus] Booking ${booking.bookingNumber} verification code:`, booking.verificationCode);
  if (booking.verificationCode?.code) {
    console.log(`[LiveStatus] ✅ Verification code exists: ${booking.verificationCode.code}`);
  } else {
    console.log(`[LiveStatus] ⚠️ No verification code found for booking ${booking.bookingNumber}`);
  }

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
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
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
      if (driver) {
        // Mark driver as not busy
        driver.isBusy = false;
        await driver.save();

        if (driver.userId) {
          await notificationService.sendNotification(
            driver.userId._id,
            'Booking Cancelled',
            `User cancelled the booking. Reason: ${reason || 'No reason provided'}`,
            'booking_cancelled',
            { bookingId: booking._id, cancelledBy: 'user', reason: reason }
          );
        }
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

// ⚠️ TESTING ONLY: User force cancel trip (for testing purposes)
// WARNING: This is for testing purposes only and should NOT be used in production
exports.userForceCancel = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  console.log('\n========== USER FORCE CANCEL (TESTING ONLY) ==========');
  console.log('[UserForceCancel] Booking ID:', bookingId);
  console.log('[UserForceCancel] User ID:', req.userId);

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  console.log('[UserForceCancel] Current booking status:', booking.status);

  // Only block if already completed or cancelled
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
    throw new ValidationError('Booking already completed or cancelled');
  }

  // ⚠️ TESTING: Allow cancelling from any status
  console.log('[UserForceCancel] ⚠️ TESTING MODE: Forcing trip cancellation by user');

  const { PAYMENT_STATUS } = require('../config/constants');

  // Handle payment status
  if (booking.payment?.status === PAYMENT_STATUS.COMPLETED || booking.payment?.status === 'completed') {
    console.log('[UserForceCancel] Payment was COMPLETED - marking for REFUND');
    booking.payment.status = PAYMENT_STATUS.REFUNDED;
    booking.payment.refundStatus = 'pending';
    booking.payment.refundDate = new Date();
    booking.payment.refundAmount = booking.payment.paidAmount || booking.pricing.totalAmount;
  }

  booking.status = BOOKING_STATUS.CANCELLED_BY_USER;
  booking.cancellationDetails = {
    cancelledBy: 'user',
    reason: reason || 'Force cancelled for testing',
    cancelledAt: new Date()
  };
  booking.timeline.cancelledAt = new Date();

  await booking.save();
  console.log('[UserForceCancel] ✅ Booking force cancelled successfully');

  // Populate driver details if exists
  if (booking.driverId) {
    await booking.populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'phoneNumber profile fcmToken' }
    });

    // Send notification to driver
    if (booking.driverId && booking.driverId.userId) {
      try {
        // Mark driver as not busy
        const driver = await Driver.findById(booking.driverId);
        if (driver) {
          driver.isBusy = false;
          await driver.save();
        }

        await notificationService.sendNotification(
          booking.driverId.userId._id,
          'Booking Cancelled',
          `User cancelled the booking. Reason: ${reason || 'Force cancelled for testing'}`,
          'booking_cancelled',
          { bookingId: booking._id, cancelledBy: 'user', reason: reason }
        );
      } catch (notifError) {
        console.error('[UserForceCancel] Failed to notify driver:', notifError.message);
      }
    }
  }

  // Emit socket event
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[UserForceCancel] Failed to emit socket event:', error.message);
  }

  console.log('========== USER FORCE CANCEL COMPLETED ==========\n');

  res.status(200).json({
    success: true,
    message: '⚠️ TESTING: Trip force cancelled by user successfully',
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
    .populate({
      path: 'driverId',
      select: 'userId vehicleDetails rating',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Booking.countDocuments(query);

  // CRITICAL: Filter out driver details for bookings where payment is not completed
  const { PAYMENT_STATUS } = require('../config/constants');

  // Generate signed URLs for profile images
  const { getSignedFileUrl, extractS3Key } = require('../config/s3');

  const bookingsWithSignedUrls = await Promise.all(
    bookings.map(async (booking) => {
      // CRITICAL: Remove driver details if payment not completed
      if (booking.payment?.status !== PAYMENT_STATUS.COMPLETED) {
        return {
          ...booking,
          driverId: null
        };
      }

      // If driver has profile image stored in S3, generate signed URL
      if (booking.driverId?.userId?.profile?.profileImage) {
        const profileImageUrl = booking.driverId.userId.profile.profileImage;

        // Check if it's an S3 URL that needs signing
        if (profileImageUrl.includes('s3.') && profileImageUrl.includes('amazonaws.com')) {
          try {
            const s3Key = extractS3Key(profileImageUrl);
            const signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
            booking.driverId.userId.profile.profileImage = signedUrl;
            console.log(`[BookingHistory] Generated signed URL for driver profile image`);
          } catch (error) {
            console.error(`[BookingHistory] Failed to generate signed URL for profile image:`, error.message);
            // Keep original URL if signing fails
          }
        }
      }

      return booking;
    })
  );

  res.status(200).json({
    success: true,
    data: {
      bookings: bookingsWithSignedUrls,
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

  console.log('\n========== ACCEPT BOOKING REQUEST ==========');
  console.log('[AcceptBooking] Booking ID:', bookingId);
  console.log('[AcceptBooking] Driver User ID:', req.userId);

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId })
    .populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  console.log('[AcceptBooking] Driver found:', driver._id);

  // Check if booking exists and is not expired BEFORE accepting
  const bookingCheck = await Booking.findById(bookingId);
  if (!bookingCheck) {
    console.log('[AcceptBooking] ❌ Booking does not exist');
    throw new NotFoundError('Booking not found');
  }

  // Check if booking has expired
  if (bookingCheck.isExpired()) {
    console.log('[AcceptBooking] ❌ Booking request has expired');
    throw new ValidationError('Booking request has expired');
  }

  // Use findOneAndUpdate with atomic update to prevent race conditions
  let booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: BOOKING_STATUS.REQUESTED,
      driverId: null
    },
    {
      $set: {
        status: BOOKING_STATUS.ACCEPTED,
        driverId: driver._id,
        'timeline.acceptedAt': new Date()
      }
    },
    { new: true }
  );

  // If booking not found or already accepted by another driver
  if (!booking) {
    console.log('[AcceptBooking] ❌ Atomic update failed - booking not found or already accepted');
    const existingBooking = await Booking.findById(bookingId);
    if (!existingBooking) {
      console.log('[AcceptBooking] ❌ Booking does not exist');
      throw new NotFoundError('Booking not found');
    }
    console.log('[AcceptBooking] Existing booking status:', existingBooking.status);
    console.log('[AcceptBooking] Existing booking driverId:', existingBooking.driverId);

    if (existingBooking.status !== BOOKING_STATUS.REQUESTED) {
      console.log('[AcceptBooking] ❌ Booking status is not REQUESTED');
      throw new ValidationError('Booking is no longer available');
    }
    if (existingBooking.driverId) {
      // Check if it's the SAME driver retrying
      if (existingBooking.driverId.toString() === driver._id.toString()) {
        console.log('[AcceptBooking] ⚠️ Same driver retrying - recovering from partial acceptance');
        // Allow the same driver to complete the acceptance (recovery mode)
        // Continue with the existing booking
        booking = existingBooking;
      } else {
        console.log('[AcceptBooking] ❌ Booking already has a DIFFERENT driver assigned');
        throw new ValidationError('Booking has already been accepted by another driver');
      }
    }

    if (!booking) {
      throw new ValidationError('Unable to accept booking');
    }
  }

  console.log('[AcceptBooking] ✅ Booking accepted successfully');

  // Ensure booking has correct status and timeline (handles both new acceptance and recovery)
  if (booking.status === BOOKING_STATUS.REQUESTED) {
    console.log('[AcceptBooking] Updating booking status from REQUESTED to ACCEPTED');
    booking.status = BOOKING_STATUS.ACCEPTED;
    booking.driverId = driver._id;
    booking.timeline.acceptedAt = booking.timeline.acceptedAt || new Date();
  }

  // Mark driver as busy
  driver.isBusy = true;
  await driver.save();

  // ============== CASH PAYMENT FLOW ==============
  // Since we're using cash payments, skip the payment waiting period
  // Driver proceeds directly to pickup after accepting
  // Payment will be collected as cash at the end of the trip

  // Set payment method to CASH
  const { PAYMENT_METHOD } = require('../config/constants');
  booking.payment.method = PAYMENT_METHOD.CASH;

  // Keep status as ACCEPTED (NOT payment_completed - that would be semantically wrong)
  // The payment.method = 'cash' field tells the system to allow proceeding without online payment
  // Booking status: ACCEPTED means driver accepted and is going to pickup
  // We do NOT change to payment_completed because user hasn't paid yet

  // Generate verification code now (will be used when driver arrives)
  const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
  booking.verificationCode = {
    code: verificationCode,
    generatedAt: new Date(),
    isVerified: false
  };

  // No payment expiry needed for cash flow
  // booking.paymentExpiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_SECONDS * 1000);
  // ================================================

  await booking.save();
  console.log('[AcceptBooking] ✅ Booking saved with status:', booking.status);
  console.log('[AcceptBooking] 💵 Payment method: CASH - Driver proceeds to pickup immediately');
  console.log('[AcceptBooking] 🔢 Verification code generated:', verificationCode);
  console.log('[AcceptBooking] ✅ Booking ID:', booking._id);
  console.log('[AcceptBooking] ✅ Driver ID:', booking.driverId);

  await booking.populate('userId', 'phoneNumber profile fcmToken');

  // Send notification to user about booking acceptance
  // Log driver profile data for debugging
  console.log('[AcceptBooking] Driver profile data:', {
    firstName: driver.userId?.profile?.firstName,
    lastName: driver.userId?.profile?.lastName,
    phoneNumber: driver.userId?.phoneNumber
  });

  // Build driver name with priority: Full Name > "Driver FirstName" > "Driver"
  let driverName = 'Driver';
  if (driver.userId?.profile?.firstName) {
    if (driver.userId.profile.lastName) {
      // Full name available
      driverName = `Driver ${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`;
    } else {
      // Only first name available
      driverName = `Driver ${driver.userId.profile.firstName}`;
    }
  }

  console.log('[AcceptBooking] Using driver name for notification:', driverName);

  try {
    await notificationService.sendNotification(
      booking.userId._id,
      'Booking Accepted',
      `${driverName} accepted your booking and is on the way! Pay by cash at the end of your trip.`,
      'booking_accepted',
      { bookingId: booking._id }
    );
    console.log('[AcceptBooking] Booking acceptance notification sent to user');
  } catch (notifError) {
    console.error('[AcceptBooking] Failed to send notification to user:', notifError.message);
    // Don't fail the booking acceptance if notification fails
  }

  // Emit Socket.IO event for real-time update - driver is now on the way
  try {
    emitBookingUpdate(booking);
    console.log('[AcceptBooking] ✅ Socket event emitted - user can now track driver');
  } catch (error) {
    console.error('[AcceptBooking] Failed to emit socket event:', error.message);
  }

  // Prepare full response - driver details included since they're on their way
  const bookingResponse = {
    id: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    paymentMethod: booking.payment.method,
    verificationCode: booking.verificationCode.code, // Driver needs this to verify at pickup
    pickupLocation: {
      latitude: booking.pickupLocation.coordinates[1],
      longitude: booking.pickupLocation.coordinates[0],
      address: booking.pickupLocation.address,
      placeName: booking.pickupLocation.placeName
    },
    // Note: dropoffLocation is hidden until trip starts (handled in getDriverActiveBooking)
    pricing: booking.pricing,
    user: {
      phoneNumber: booking.userId?.phoneNumber,
      firstName: booking.userId?.profile?.firstName,
      lastName: booking.userId?.profile?.lastName
    },
    message: 'Booking accepted. Proceed to pickup location. Collect cash payment at the end of the trip.'
  };

  res.status(200).json({
    success: true,
    message: 'Booking accepted successfully. Proceed to pickup location.',
    data: {
      booking: bookingResponse
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

  // ============== CASH PAYMENT FLOW ==============
  // For cash flow, we always return full trip details since payment happens at the end
  // The booking status is set to PAYMENT_COMPLETED upon acceptance, allowing driver to proceed
  console.log('[GetDriverActiveBooking] 💵 Cash payment flow - returning full trip details');
  console.log('[GetDriverActiveBooking] Booking status:', booking.status);
  console.log('[GetDriverActiveBooking] Payment method:', booking.payment?.method);

  const bookingResponse = booking.toObject();

  // Hide dropoff location until trip starts (IN_PROGRESS status)
  if (booking.status !== BOOKING_STATUS.IN_PROGRESS && booking.status !== BOOKING_STATUS.COMPLETED) {
    delete bookingResponse.dropoffLocation;
  }

  // Add cash collection info for driver
  bookingResponse.paymentMethod = booking.payment?.method || 'cash';
  bookingResponse.cashCollectionRequired = booking.payment?.method === 'cash' && booking.payment?.status !== 'completed';
  bookingResponse.amountToCollect = booking.pricing?.totalAmount;

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

  // Check if valid state to proceed
  const { PAYMENT_METHOD } = require('../config/constants');

  // Allow if:
  // 1. Online payment completed (status is PAYMENT_COMPLETED)
  // 2. Cash payment accepted (status is ACCEPTED and method is CASH)
  const isOnlinePaymentCompleted = booking.status === BOOKING_STATUS.PAYMENT_COMPLETED;
  const isCashPaymentAccepted = booking.status === BOOKING_STATUS.ACCEPTED && booking.payment?.method === PAYMENT_METHOD.CASH;

  if (!isOnlinePaymentCompleted && !isCashPaymentAccepted) {
    // If it's a cash booking but not accepted (e.g. still requested), or online booking not paid
    if (booking.status === BOOKING_STATUS.REQUESTED) {
      throw new ValidationError('Booking must be accepted first');
    }

    if (booking.payment?.method === PAYMENT_METHOD.CASH && booking.status !== BOOKING_STATUS.ACCEPTED) {
      throw new ValidationError('Cash booking must be in ACCEPTED state');
    }

    throw new ValidationError('Payment must be completed before driver can mark arrival');
  }

  // Use existing verification code or generate a new one if it doesn't exist
  let verificationCode;
  if (booking.verificationCode && booking.verificationCode.code) {
    verificationCode = booking.verificationCode.code;
    console.log('[MarkDriverArrived] Using existing verification code:', verificationCode);
  } else {
    verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    booking.verificationCode = {
      code: verificationCode,
      generatedAt: new Date(),
      isVerified: false
    };
    console.log('[MarkDriverArrived] Generated new verification code:', verificationCode);
  }

  booking.status = BOOKING_STATUS.DRIVER_ARRIVED;
  booking.timeline.driverArrivedAt = new Date();
  await booking.save();

  // Populate booking for response
  await booking.populate('userId', 'phoneNumber profile fcmToken');

  // Send notification to user with verification code
  await notificationService.sendNotification(
    booking.userId._id,
    'Driver Arrived',
    `Your driver has arrived! Share verification code ${verificationCode} with your driver. Remember: Pay by cash at the end of your trip.`,
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

// Verify pickup code (driver enters code provided by user)
exports.verifyPickupCode = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { verificationCode } = req.body;

  console.log('\n========== VERIFY PICKUP CODE ==========');
  console.log('[VerifyPickupCode] Booking ID:', bookingId);
  console.log('[VerifyPickupCode] Code entered by driver:', verificationCode);

  if (!verificationCode) {
    throw new ValidationError('Verification code is required');
  }

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    console.log('[VerifyPickupCode] ❌ Booking not found');
    throw new NotFoundError('Booking not found');
  }

  console.log('[VerifyPickupCode] Current booking status:', booking.status);
  console.log('[VerifyPickupCode] Stored verification code:', booking.verificationCode?.code);
  console.log('[VerifyPickupCode] Is already verified?', booking.verificationCode?.isVerified);

  // Check if code exists
  if (!booking.verificationCode?.code) {
    console.log('[VerifyPickupCode] ❌ No verification code found in booking');
    throw new ValidationError('No verification code found for this booking');
  }

  // Check if already verified
  if (booking.verificationCode.isVerified) {
    console.log('[VerifyPickupCode] ⚠️ Code already verified');
    return res.status(200).json({
      success: true,
      message: 'Verification code already verified',
      data: {
        verified: true,
        verifiedAt: booking.verificationCode.verifiedAt
      }
    });
  }

  // Verify the code
  if (booking.verificationCode.code !== verificationCode.toString().trim()) {
    console.log('[VerifyPickupCode] ❌ Code mismatch');
    console.log('[VerifyPickupCode] Expected:', booking.verificationCode.code);
    console.log('[VerifyPickupCode] Received:', verificationCode.toString().trim());
    throw new ValidationError('Invalid verification code');
  }

  // Mark code as verified
  booking.verificationCode.isVerified = true;
  booking.verificationCode.verifiedAt = new Date();

  // IMPORTANT: Automatically mark driver as arrived when code is verified
  // The act of verifying the code confirms driver has physically arrived
  if (booking.status === BOOKING_STATUS.PAYMENT_COMPLETED) {
    booking.status = BOOKING_STATUS.DRIVER_ARRIVED;
    booking.timeline.driverArrivedAt = new Date();
    console.log('[VerifyPickupCode] ✅ Auto-marking driver as ARRIVED (code verification confirms arrival)');
  }

  await booking.save();

  console.log('[VerifyPickupCode] ✅ Code verified successfully');

  // Populate for response
  await booking.populate('userId', 'phoneNumber profile');

  // Send notification to user that driver has verified pickup
  try {
    await notificationService.sendNotification(
      booking.userId._id,
      'Pickup Verified',
      'Driver has verified the pickup code. Your trip will start shortly.',
      'pickup_verified',
      { bookingId: booking._id }
    );
    console.log('[VerifyPickupCode] Pickup verified notification sent to user');
  } catch (notifError) {
    console.error('[VerifyPickupCode] Failed to send notification:', notifError.message);
  }

  // Emit Socket.IO event
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[VerifyPickupCode] Failed to emit socket event:', error.message);
  }

  console.log('========== END VERIFY PICKUP CODE ==========\n');

  res.status(200).json({
    success: true,
    message: 'Pickup code verified successfully. You can now start the trip.',
    data: {
      verified: true,
      verifiedAt: booking.verificationCode.verifiedAt,
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        dropoffLocation: booking.dropoffLocation
      }
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

  // if (booking.status !== BOOKING_STATUS.DRIVER_ARRIVED) {
  //   throw new ValidationError('Driver must arrive at pickup before starting trip');
  // }

  // Check if verification code is verified
  // if (!booking.verificationCode?.isVerified) {
  //   throw new ValidationError('You must verify the pickup code before starting trip');
  // }

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

  // ============== CASH PAYMENT FLOW ==============
  // For cash payments, verify that cash has been collected before completing trip
  const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../config/constants');

  if (booking.payment?.method === PAYMENT_METHOD.CASH) {
    if (booking.payment?.status !== PAYMENT_STATUS.COMPLETED) {
      throw new ValidationError('Please confirm cash collection before completing the trip. Use the "Collect Cash" button first.');
    }
    console.log('[CompleteTrip] ✅ Cash collection verified - payment status:', booking.payment.status);
  }
  // ================================================

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

  // Get admin-configurable driver commission percentage (default 25%)
  const AdminSettings = require('../models/AdminSettings');
  const Transaction = require('../models/Transaction');

  let driverCommissionPercentage = 25; // Default 25%

  try {
    const commissionSetting = await AdminSettings.findOne({ settingKey: 'driver_commission_percentage' });
    if (commissionSetting && commissionSetting.settingValue) {
      driverCommissionPercentage = parseFloat(commissionSetting.settingValue);
      console.log(`[CompleteTrip] Using admin-configured driver commission: ${driverCommissionPercentage}%`);
    } else {
      console.log(`[CompleteTrip] No admin setting found, using default commission: ${driverCommissionPercentage}%`);
    }
  } catch (error) {
    console.error('[CompleteTrip] Failed to fetch admin commission setting:', error.message);
    console.log(`[CompleteTrip] Falling back to default commission: ${driverCommissionPercentage}%`);
  }

  // Calculate driver earnings based on commission percentage
  const totalAmount = booking.pricing.totalAmount;
  const driverEarnings = (totalAmount * driverCommissionPercentage) / 100;
  const platformCommission = totalAmount - driverEarnings;

  booking.platformCommission = Math.round(platformCommission * 100) / 100;
  booking.driverEarnings = Math.round(driverEarnings * 100) / 100;
  booking.status = BOOKING_STATUS.COMPLETED;
  booking.timeline.completedAt = new Date();
  await booking.save();

  console.log(`[CompleteTrip] Trip completed - Total: ${totalAmount} QAR, Driver gets: ${booking.driverEarnings} QAR (${driverCommissionPercentage}%), Platform: ${booking.platformCommission} QAR`);

  // Credit driver's wallet with earnings
  if (!driver.wallet) {
    driver.wallet = { balance: 0, pendingAmount: 0 };
  }
  driver.wallet.balance += booking.driverEarnings;

  // Also update legacy earnings field for backward compatibility
  driver.earnings.totalEarnings += booking.driverEarnings;
  driver.earnings.availableBalance += booking.driverEarnings;
  driver.isBusy = false; // Driver is now available
  await driver.save();

  console.log(`[CompleteTrip] Driver wallet credited - New balance: ${driver.wallet.balance} QAR`);

  // Create transaction record for driver earnings
  try {
    const { TRANSACTION_TYPE } = require('../config/constants');
    await Transaction.create({
      driverId: driver._id,
      userId: booking.userId,
      bookingId: booking._id,
      type: TRANSACTION_TYPE.DRIVER_EARNING,
      amount: booking.driverEarnings,
      currency: booking.pricing.currency || 'QAR',
      status: 'completed',
      description: `Earnings from trip ${booking.bookingNumber} (${driverCommissionPercentage}% commission)`
    });
    console.log(`[CompleteTrip] Transaction record created for driver earnings`);
  } catch (txError) {
    console.error('[CompleteTrip] Failed to create transaction record:', txError.message);
    // Don't fail trip completion if transaction record fails
  }

  // Populate user and driver details for notifications
  await booking.populate('userId', 'phoneNumber profile fcmToken');
  await driver.populate('userId', 'phoneNumber profile');

  // Send notification to user about trip completion
  const driverName = driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
    ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
    : driver.userId?.phoneNumber || 'Driver';

  try {
    await notificationService.sendNotification(
      booking.userId._id,
      'Trip Completed',
      `Your trip with ${driverName} has been completed successfully! Amount: ${booking.pricing.totalAmount} ${booking.pricing.currency}`,
      'trip_completed',
      {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        driverName: driverName
      }
    );
    console.log('[CompleteTrip] Trip completion notification sent to user');
  } catch (notifError) {
    console.error('[CompleteTrip] Failed to send notification to user:', notifError.message);
    // Don't fail the trip completion if notification fails
  }

  // Clear Redis cache for active booking
  const { isRedisAvailable } = require('../config/redis');
  if (isRedisAvailable()) {
    try {
      await redisService.clearActiveBooking(driver._id);
      console.log('[CompleteTrip] Cleared Redis cache for driver:', driver._id);
    } catch (redisError) {
      console.error('[CompleteTrip] Failed to clear Redis cache:', redisError.message);
    }
  }

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

// ============== CASH PAYMENT FLOW ==============
// Confirm cash collection by driver (must be called before completing trip)
exports.confirmCashCollection = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { amountCollected } = req.body;

  console.log('\n========== CONFIRM CASH COLLECTION ==========');
  console.log('[ConfirmCashCollection] Booking ID:', bookingId);
  console.log('[ConfirmCashCollection] Driver User ID:', req.userId);
  console.log('[ConfirmCashCollection] Amount collected:', amountCollected);

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Verify booking is in a valid state for cash collection
  if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new ValidationError('Cash can only be collected when trip is in progress');
  }

  // Verify payment method is cash
  const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../config/constants');
  if (booking.payment?.method !== PAYMENT_METHOD.CASH) {
    throw new ValidationError('This booking is not a cash payment');
  }

  // Verify amount collected matches expected amount (with 1 QAR tolerance for rounding)
  const expectedAmount = booking.pricing.totalAmount;
  const collectedAmount = parseFloat(amountCollected) || 0;

  if (Math.abs(collectedAmount - expectedAmount) > 1) {
    console.log('[ConfirmCashCollection] ⚠️ Amount mismatch - Expected:', expectedAmount, 'Collected:', collectedAmount);
    throw new ValidationError(`Amount mismatch. Expected: ${expectedAmount} ${booking.pricing.currency}, Collected: ${collectedAmount} ${booking.pricing.currency}`);
  }

  // Update payment status
  booking.payment.status = PAYMENT_STATUS.COMPLETED;
  booking.payment.paidAmount = collectedAmount;
  booking.payment.paidAt = new Date();
  booking.payment.cashCollectedAt = new Date();
  booking.payment.cashCollectedBy = driver._id;

  await booking.save();

  console.log('[ConfirmCashCollection] ✅ Cash collection confirmed');
  console.log('[ConfirmCashCollection] Amount:', collectedAmount, booking.pricing.currency);
  console.log('[ConfirmCashCollection] Payment status updated to:', booking.payment.status);
  console.log('========== END CONFIRM CASH COLLECTION ==========\n');

  // Populate for response
  await booking.populate('userId', 'phoneNumber profile');

  // Send notification to user confirming payment received
  try {
    await notificationService.sendNotification(
      booking.userId._id,
      'Payment Received',
      `Your cash payment of ${collectedAmount} ${booking.pricing.currency} has been received. Thank you!`,
      'payment_received',
      { bookingId: booking._id, amount: collectedAmount, currency: booking.pricing.currency }
    );
    console.log('[ConfirmCashCollection] Payment confirmation notification sent to user');
  } catch (notifError) {
    console.error('[ConfirmCashCollection] Failed to send notification:', notifError.message);
  }

  // Emit Socket.IO event for real-time update
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[ConfirmCashCollection] Failed to emit socket event:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Cash payment confirmed successfully. You can now complete the trip.',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      amountCollected: collectedAmount,
      currency: booking.pricing.currency,
      paymentStatus: booking.payment.status,
      cashCollectedAt: booking.payment.cashCollectedAt,
      canCompleteTrip: true
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

  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
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

  // Mark driver as not busy
  if (driver) {
    driver.isBusy = false;
    await driver.save();
  }
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

// ⚠️ TESTING ONLY: Force complete trip (bypasses all verification checks)
// WARNING: This is for testing purposes only and should NOT be used in production
exports.forceComplete = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  console.log('\n========== FORCE COMPLETE (TESTING ONLY) ==========');
  console.log('[ForceComplete] Booking ID:', bookingId);

  // No auth required - find booking directly
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  console.log('[ForceComplete] Current booking status:', booking.status);

  // Only block if already completed or cancelled
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
    throw new ValidationError('Booking already completed or cancelled');
  }

  // ⚠️ TESTING: Skip all checks and complete the trip
  console.log('[ForceComplete] ⚠️ TESTING MODE: Forcing trip completion');

  // Calculate driver earnings and platform commission
  const pricing = await PricingConfig.findOne({ vehicleType: booking.vehicleType });
  const commissionPercentage = pricing?.driverCommissionPercentage || 20;

  booking.platformCommission = (booking.pricing.totalAmount * commissionPercentage) / 100;
  booking.driverEarnings = booking.pricing.totalAmount - booking.platformCommission;

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.timeline.completedAt = new Date();

  // Set started time if not set
  if (!booking.timeline.startedAt) {
    booking.timeline.startedAt = new Date(Date.now() - 300000); // 5 mins ago
  }

  await booking.save();

  // Update driver earnings and set as not busy (if driver exists)
  if (booking.driverId) {
    const driver = await Driver.findById(booking.driverId);
    if (driver) {
      driver.earnings.totalEarnings += booking.driverEarnings;
      driver.earnings.availableBalance += booking.driverEarnings;
      driver.isBusy = false; // Driver is now available
      await driver.save();

      // Clear Redis cache for active booking
      if (isRedisAvailable()) {
        try {
          await redisService.clearActiveBooking(driver._id);
          console.log('[ForceComplete] Cleared Redis cache for driver:', driver._id);
        } catch (redisError) {
          console.error('[ForceComplete] Failed to clear Redis cache:', redisError.message);
        }
      }
    }
  }

  console.log('[ForceComplete] ✅ Booking force completed successfully');
  console.log('[ForceComplete] Driver earnings:', booking.driverEarnings);
  console.log('[ForceComplete] Platform commission:', booking.platformCommission);

  // Populate user and driver details
  await booking.populate('userId', 'phoneNumber profile fcmToken');
  if (booking.driverId) {
    await booking.populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'phoneNumber profile' }
    });
  }

  // Send notification (if driver details available)
  let driverName = 'Driver';
  if (booking.driverId?.userId?.profile?.firstName && booking.driverId?.userId?.profile?.lastName) {
    driverName = `${booking.driverId.userId.profile.firstName} ${booking.driverId.userId.profile.lastName}`;
  } else if (booking.driverId?.userId?.phoneNumber) {
    driverName = booking.driverId.userId.phoneNumber;
  }

  try {
    await notificationService.sendNotification(
      booking.userId._id,
      'Trip Completed',
      `Your trip with ${driverName} has been completed! Amount: ${booking.pricing.totalAmount} ${booking.pricing.currency}`,
      'trip_completed',
      {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        totalAmount: booking.pricing.totalAmount
      }
    );
  } catch (notifError) {
    console.error('[ForceComplete] Failed to notify user:', notifError.message);
  }

  // Emit socket event
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[ForceComplete] Failed to emit socket event:', error.message);
  }

  console.log('========== FORCE COMPLETE COMPLETED ==========\n');

  res.status(200).json({
    success: true,
    message: '⚠️ TESTING: Trip force completed successfully',
    data: {
      booking,
      earnings: booking.driverEarnings,
      commission: booking.platformCommission
    }
  });
});

// ⚠️ TESTING ONLY: Force cancel ongoing trip (allows cancelling in_progress trips)
// WARNING: This is for testing purposes only and should NOT be used in production
exports.forceCancel = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  console.log('\n========== FORCE CANCEL (TESTING ONLY) ==========');
  console.log('[ForceCancel] Booking ID:', bookingId);
  console.log('[ForceCancel] Reason:', reason);

  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found or not assigned to you');
  }

  console.log('[ForceCancel] Current booking status:', booking.status);

  // Only block if already cancelled or completed
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
    throw new ValidationError('Booking already completed or cancelled');
  }

  // ⚠️ TESTING: Allow cancelling IN_PROGRESS trips
  console.log('[ForceCancel] ⚠️ TESTING MODE: Allowing cancellation of in_progress trip');

  const { PAYMENT_STATUS } = require('../config/constants');

  // Handle refund for completed payments
  if (booking.payment?.status === PAYMENT_STATUS.COMPLETED || booking.payment?.status === 'completed') {
    console.log('[ForceCancel] Payment was COMPLETED - marking for REFUND');
    booking.payment.status = PAYMENT_STATUS.REFUNDED;
    booking.payment.refundStatus = 'pending';
    booking.payment.refundDate = new Date();
    booking.payment.refundAmount = booking.payment.paidAmount || booking.pricing.totalAmount;
  }

  booking.status = BOOKING_STATUS.CANCELLED_BY_DRIVER;
  booking.cancellationDetails = {
    cancelledBy: 'driver',
    reason: reason || 'Force cancelled for testing',
    cancelledAt: new Date()
  };
  booking.timeline.cancelledAt = new Date();

  await booking.save();
  console.log('[ForceCancel] ✅ Booking force cancelled successfully');

  // Populate and notify user
  await booking.populate('userId', 'phoneNumber profile fcmToken');

  if (booking.userId) {
    try {
      await notificationService.sendNotification(
        booking.userId._id,
        'Trip Cancelled',
        `Driver cancelled the ongoing trip. Reason: ${reason || 'Force cancelled for testing'}`,
        'booking_cancelled',
        { bookingId: booking._id, cancelledBy: 'driver', reason: reason }
      );
    } catch (notifError) {
      console.error('[ForceCancel] Failed to notify user:', notifError.message);
    }
  }

  // Emit socket event
  try {
    emitBookingUpdate(booking);
  } catch (error) {
    console.error('[ForceCancel] Failed to emit socket event:', error.message);
  }

  console.log('========== FORCE CANCEL COMPLETED ==========\n');

  res.status(200).json({
    success: true,
    message: '⚠️ TESTING: Trip force cancelled successfully',
    data: { booking }
  });
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
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Booking.countDocuments(query);

  // Generate signed URLs for user profile images
  const { getSignedFileUrl, extractS3Key } = require('../config/s3');

  const bookingsWithSignedUrls = await Promise.all(
    bookings.map(async (booking) => {
      // If user has profile image stored in S3, generate signed URL
      if (booking.userId?.profile?.profileImage) {
        const profileImageUrl = booking.userId.profile.profileImage;

        // Check if it's an S3 URL that needs signing
        if (profileImageUrl.includes('s3.') && profileImageUrl.includes('amazonaws.com')) {
          try {
            const s3Key = extractS3Key(profileImageUrl);
            const signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
            booking.userId.profile.profileImage = signedUrl;
            console.log(`[DriverBookingHistory] Generated signed URL for user profile image`);
          } catch (error) {
            console.error(`[DriverBookingHistory] Failed to generate signed URL for profile image:`, error.message);
            // Keep original URL if signing fails
          }
        }
      }

      return booking;
    })
  );

  res.status(200).json({
    success: true,
    data: {
      bookings: bookingsWithSignedUrls,
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

  // Calculate pricing: 10 QAR per km, base price 110 (switches to 0 if distance >= 110)
  const minimumCharge = 110;
  const perKmRate = 10;
  const distancePrice = tripRoute.distance * perKmRate;
  // Base price: 110 if distance < 110, else 0
  const basePrice = distancePrice >= minimumCharge ? 0 : minimumCharge;
  // Total: base + distance
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
    console.log('[RequestDriver] 🔔 Attempting to send FCM notification to driver...');
    console.log('[RequestDriver] Driver ID:', driver._id);
    console.log('[RequestDriver] Driver FCM Token:', driver.fcmToken || driver.userId?.fcmToken || 'NO TOKEN');
    console.log('[RequestDriver] Booking ID:', booking._id);
    console.log('[RequestDriver] Pickup Address:', pickupLocation.address || 'Pickup location');
    console.log('[RequestDriver] Additional Data:', {
      eta: driverToPickup.duration,
      pricing: totalAmount,
      bookingNumber: booking.bookingNumber
    });

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
    console.log('[RequestDriver] ✅ FCM notification sent to driver successfully');
  } catch (notificationError) {
    console.error('[RequestDriver] ❌ Failed to send FCM notification to driver:', notificationError.message);
    console.error('[RequestDriver] ❌ Full error:', notificationError);
    // Don't fail the request if notification fails
  }

  // Emit socket event to driver for real-time notification
  try {
    const { emitNewBookingRequest } = require('../services/socket.service');

    const bookingPayload = {
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
      vehicleDetails: vehicleDetails,
      pricing: {
        total: totalAmount,
        basePrice: basePrice,
        perKmRate: perKmRate,
        distance: tripRoute.distance
      },
      eta: driverToPickup.duration,
      expiresAt: booking.requestExpiresAt,
      requestExpiresAt: booking.requestExpiresAt,  // Explicit field for clarity
      userId: booking.userId._id.toString(),
      user: {
        id: booking.userId._id.toString(),
        phoneNumber: booking.userId.phoneNumber,
        name: booking.userId.profile?.firstName
          ? `${booking.userId.profile.firstName} ${booking.userId.profile.lastName || ''}`.trim()
          : 'User'
      },
      status: 'requested',
      createdAt: booking.createdAt,
      timestamp: new Date().toISOString()
    };

    // Emit to driver using the dedicated service function
    // Use driver._id (Driver document ID) because socket rooms use pattern: driver:${driverId}
    // The driverId is set from driver._id during socket authentication (socket.js:116)
    emitNewBookingRequest(driver._id.toString(), bookingPayload);
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
