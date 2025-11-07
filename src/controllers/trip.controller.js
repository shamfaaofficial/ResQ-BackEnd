const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { BOOKING_STATUS } = require('../config/constants');
const { calculateDistance } = require('../utils/helpers');

/**
 * USER - Get Trip Details with Verification Code and Driver Info
 */
exports.getTripDetails = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  })
    .populate('userId', 'phoneNumber profile')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Prepare driver details
  let driverDetails = null;
  if (booking.driverId) {
    driverDetails = {
      id: booking.driverId._id,
      name: booking.driverId.userId.profile?.firstName
        ? `${booking.driverId.userId.profile.firstName} ${booking.driverId.userId.profile.lastName || ''}`.trim()
        : 'Driver',
      phoneNumber: booking.driverId.userId.phoneNumber,
      vehicleType: booking.driverId.vehicleDetails?.vehicleType,
      vehicleNumber: booking.driverId.vehicleDetails?.vehicleNumber,
      vehicleMake: booking.driverId.vehicleDetails?.make,
      vehicleModel: booking.driverId.vehicleDetails?.model,
      vehicleColor: booking.driverId.vehicleDetails?.color,
      rating: booking.driverId.rating?.average || 0,
      totalTrips: booking.driverId.rating?.totalRatings || 0,
      currentLocation: booking.driverId.currentLocation
    };
  }

  // Prepare trip details
  const tripDetails = {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,

    // Pickup & Dropoff
    pickupLocation: {
      coordinates: booking.pickupLocation.coordinates,
      address: booking.pickupLocation.address,
      placeName: booking.pickupLocation.placeName
    },
    dropoffLocation: {
      coordinates: booking.dropoffLocation.coordinates,
      address: booking.dropoffLocation.address,
      placeName: booking.dropoffLocation.placeName
    },

    // Pricing
    pricing: {
      basePrice: booking.pricing.basePrice,
      perKmRate: booking.pricing.perKmRate,
      distance: booking.pricing.totalDistance,
      distancePrice: booking.pricing.distancePrice,
      totalAmount: booking.pricing.totalAmount,
      currency: booking.pricing.currency
    },

    // Payment
    payment: {
      status: booking.payment?.status,
      method: booking.payment?.method,
      transactionId: booking.payment?.transactionId,
      paidAt: booking.payment?.paidAt
    },

    // Verification Code (only show after driver arrives)
    verificationCode: booking.status === BOOKING_STATUS.DRIVER_ARRIVED
      ? {
          code: booking.verificationCode?.code,
          isVerified: booking.verificationCode?.isVerified || false
        }
      : null,

    // Driver Details
    driver: driverDetails,

    // Timeline
    timeline: {
      requestedAt: booking.timeline.requestedAt,
      acceptedAt: booking.timeline.acceptedAt,
      paymentCompletedAt: booking.timeline.paymentCompletedAt,
      driverArrivedAt: booking.timeline.driverArrivedAt,
      startedAt: booking.timeline.startedAt,
      completedAt: booking.timeline.completedAt
    },

    // Timestamps
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt
  };

  res.status(200).json({
    success: true,
    data: tripDetails
  });
});

/**
 * DRIVER - Mark Arrival at Pickup Location
 */
exports.markDriverArrived = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { latitude, longitude } = req.body;

  // Validate location data
  if (!latitude || !longitude) {
    throw new ValidationError('Current location (latitude, longitude) is required');
  }

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new ValidationError('Latitude and longitude must be numbers');
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new ValidationError('Invalid coordinates');
  }

  // Find driver
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find booking
  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found or not assigned to you');
  }

  // Check booking status - must be 'accepted' or 'payment_completed'
  if (![BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.PAYMENT_COMPLETED].includes(booking.status)) {
    throw new ValidationError(`Cannot mark arrival. Current booking status: ${booking.status}`);
  }

  // Extract pickup location coordinates [lng, lat]
  const pickupLng = booking.pickupLocation.coordinates[0];
  const pickupLat = booking.pickupLocation.coordinates[1];

  // Calculate distance between driver's current location and pickup location (in km)
  const distanceInKm = calculateDistance(latitude, longitude, pickupLat, pickupLng);
  const distanceInMeters = distanceInKm * 1000;

  // Get arrival threshold from environment or use default (100 meters)
  const ARRIVAL_THRESHOLD = process.env.DRIVER_ARRIVAL_RADIUS_METERS || 100;

  // Verify driver is within threshold
  if (distanceInMeters > ARRIVAL_THRESHOLD) {
    return res.status(400).json({
      success: false,
      message: `You must be within ${ARRIVAL_THRESHOLD}m of pickup location to mark arrival`,
      data: {
        currentDistance: Math.round(distanceInMeters),
        requiredDistance: ARRIVAL_THRESHOLD,
        unit: 'meters'
      }
    });
  }

  // Update booking with arrival verification
  booking.status = BOOKING_STATUS.DRIVER_ARRIVED;
  booking.timeline.driverArrivedAt = new Date();
  booking.arrivalVerification = {
    driverLocation: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    distanceFromPickup: Math.round(distanceInMeters),
    verifiedAt: new Date(),
    isVerified: true
  };

  await booking.save();

  res.status(200).json({
    success: true,
    message: 'Arrival confirmed successfully',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      arrivedAt: booking.timeline.driverArrivedAt,
      distanceFromPickup: Math.round(distanceInMeters),
      verificationCode: booking.verificationCode?.code
    }
  });
});

/**
 * DRIVER - Verify Pickup Code
 */
exports.verifyPickupCode = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { verificationCode } = req.body;

  if (!verificationCode) {
    throw new ValidationError('Verification code is required');
  }

  // Find driver
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find booking
  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  });

  if (!booking) {
    throw new NotFoundError('Booking not found or not assigned to you');
  }

  // Check if driver has arrived
  if (booking.status !== BOOKING_STATUS.DRIVER_ARRIVED) {
    throw new ValidationError('You must arrive at pickup location first');
  }

  // Check if code already verified
  if (booking.verificationCode?.isVerified) {
    throw new ValidationError('Verification code already used');
  }

  // Verify the code
  if (booking.verificationCode?.code !== verificationCode.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code'
    });
  }

  // Mark as verified
  booking.verificationCode.isVerified = true;
  booking.verificationCode.verifiedAt = new Date();
  await booking.save();

  res.status(200).json({
    success: true,
    message: 'Verification successful! You can now start the trip.',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      verified: true,
      verifiedAt: booking.verificationCode.verifiedAt
    }
  });
});

/**
 * DRIVER - Get Trip Details
 */
exports.getDriverTripDetails = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Find driver
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  })
    .populate('userId', 'phoneNumber profile');

  if (!booking) {
    throw new NotFoundError('Booking not found or not assigned to you');
  }

  const tripDetails = {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,

    // User Details
    user: {
      name: booking.userId.profile?.firstName
        ? `${booking.userId.profile.firstName} ${booking.userId.profile.lastName || ''}`.trim()
        : 'User',
      phoneNumber: booking.userId.phoneNumber
    },

    // Locations (dropoff only shown after verification)
    pickupLocation: {
      coordinates: booking.pickupLocation.coordinates,
      address: booking.pickupLocation.address,
      placeName: booking.pickupLocation.placeName
    },
    dropoffLocation: booking.verificationCode?.isVerified || booking.status === BOOKING_STATUS.IN_PROGRESS
      ? {
          coordinates: booking.dropoffLocation.coordinates,
          address: booking.dropoffLocation.address,
          placeName: booking.dropoffLocation.placeName
        }
      : null,

    // Pricing
    pricing: {
      totalAmount: booking.pricing.totalAmount,
      currency: booking.pricing.currency,
      distance: booking.pricing.totalDistance
    },

    // Verification Status
    verification: {
      isRequired: booking.status === BOOKING_STATUS.DRIVER_ARRIVED,
      isVerified: booking.verificationCode?.isVerified || false,
      verifiedAt: booking.verificationCode?.verifiedAt
    },

    // Timeline
    timeline: booking.timeline,

    createdAt: booking.createdAt
  };

  res.status(200).json({
    success: true,
    data: tripDetails
  });
});

module.exports = exports;
