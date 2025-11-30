const asyncHandler = require('express-async-handler');
const Rating = require('../models/Rating');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const User = require('../models/User');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { BOOKING_STATUS } = require('../config/constants');

/**
 * USER: Submit rating for driver
 * POST /api/v1/user/rate-driver/:bookingId
 */
exports.rateDriver = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const {
    professionalism,
    serviceQuality,
    timeliness,
    vehicleHandling,
    overall,
    feedback,
    tags
  } = req.body;

  console.log(`[RateDriver] User ${req.userId} rating booking ${bookingId}`);

  // Find booking
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'phoneNumber profile')
    .populate('driverId', 'userId');

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Verify booking belongs to user
  if (booking.userId._id.toString() !== req.userId) {
    throw new AuthorizationError('You can only rate your own bookings');
  }

  // Verify booking is completed
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ValidationError('Can only rate completed trips');
  }

  // Check if already rated
  const existingRating = await Rating.findOne({ bookingId, ratedByRole: 'user' });
  if (existingRating) {
    throw new ValidationError('You have already rated this trip');
  }

  // Validate overall rating
  if (!overall || overall < 1 || overall > 5) {
    throw new ValidationError('Overall rating must be between 1 and 5');
  }

  // Create rating
  const rating = await Rating.create({
    bookingId: booking._id,
    ratedUser: booking.userId._id,
    ratedDriver: booking.driverId._id,
    ratedBy: req.userId,
    ratedByRole: 'user',
    driverRating: {
      professionalism: professionalism || null,
      serviceQuality: serviceQuality || null,
      timeliness: timeliness || null,
      vehicleHandling: vehicleHandling || null,
      overall,
      feedback: feedback || '',
      tags: tags || []
    }
  });

  console.log(`[RateDriver] Rating created:`, rating._id);

  // Update driver's rating statistics
  await updateDriverRatingStats(booking.driverId._id);

  // Get updated driver stats
  const driver = await Driver.findById(booking.driverId._id).select('rating');

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: {
      ratingId: rating._id,
      overall: rating.driverRating.overall,
      driverStats: {
        average: driver.rating.average,
        totalRatings: driver.rating.totalRatings
      }
    }
  });
});

/**
 * DRIVER: Submit rating for user
 * POST /api/v1/driver/rate-user/:bookingId
 */
exports.rateUser = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const {
    cooperation,
    locationAccuracy,
    communication,
    overall,
    feedback,
    tags
  } = req.body;

  console.log(`[RateUser] Driver rating booking ${bookingId}`);

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find booking
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'phoneNumber profile')
    .populate('driverId', 'userId');

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Verify booking belongs to driver
  if (booking.driverId._id.toString() !== driver._id.toString()) {
    throw new AuthorizationError('You can only rate your own trips');
  }

  // Verify booking is completed
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ValidationError('Can only rate completed trips');
  }

  // Check if already rated
  const existingRating = await Rating.findOne({ bookingId, ratedByRole: 'driver' });
  if (existingRating) {
    throw new ValidationError('You have already rated this user');
  }

  // Validate overall rating
  if (!overall || overall < 1 || overall > 5) {
    throw new ValidationError('Overall rating must be between 1 and 5');
  }

  // Create rating
  const rating = await Rating.create({
    bookingId: booking._id,
    ratedUser: booking.userId._id,
    ratedDriver: booking.driverId._id,
    ratedBy: req.userId,
    ratedByRole: 'driver',
    userRating: {
      cooperation: cooperation || null,
      locationAccuracy: locationAccuracy || null,
      communication: communication || null,
      overall,
      feedback: feedback || '',
      tags: tags || []
    }
  });

  console.log(`[RateUser] Rating created:`, rating._id);

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: {
      ratingId: rating._id,
      overall: rating.userRating.overall
    }
  });
});

/**
 * Get rating for a specific booking
 * GET /api/v1/ratings/booking/:bookingId
 */
exports.getBookingRating = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const rating = await Rating.findOne({ bookingId })
    .populate('ratedUser', 'phoneNumber profile')
    .populate('ratedDriver', 'userId vehicleDetails')
    .populate('ratedBy', 'phoneNumber profile');

  if (!rating) {
    return res.status(404).json({
      success: false,
      message: 'No rating found for this booking'
    });
  }

  res.status(200).json({
    success: true,
    data: rating
  });
});

/**
 * Get driver's ratings and reviews
 * GET /api/v1/ratings/driver/:driverId
 */
exports.getDriverRatings = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { page = 1, limit = 10, minRating } = req.query;

  const query = {
    ratedDriver: driverId,
    ratedByRole: 'user'
  };

  // Filter by minimum rating
  if (minRating) {
    query['driverRating.overall'] = { $gte: parseInt(minRating) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [ratings, total, driver] = await Promise.all([
    Rating.find(query)
      .populate('ratedUser', 'phoneNumber profile')
      .populate('bookingId', 'bookingNumber createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Rating.countDocuments(query),
    Driver.findById(driverId).select('rating userId vehicleDetails')
  ]);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  res.status(200).json({
    success: true,
    data: {
      driver: {
        id: driver._id,
        rating: driver.rating
      },
      ratings: ratings.map(r => ({
        id: r._id,
        bookingNumber: r.bookingId?.bookingNumber,
        professionalism: r.driverRating.professionalism,
        serviceQuality: r.driverRating.serviceQuality,
        timeliness: r.driverRating.timeliness,
        vehicleHandling: r.driverRating.vehicleHandling,
        overall: r.driverRating.overall,
        feedback: r.driverRating.feedback,
        tags: r.driverRating.tags,
        createdAt: r.createdAt
      })),
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
 * Check if user can rate a booking
 * GET /api/v1/ratings/can-rate/:bookingId
 */
exports.canRate = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userRole = req.userRole; // 'user' or 'driver'

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check if booking is completed
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    return res.status(200).json({
      success: true,
      canRate: false,
      reason: 'Trip not completed yet'
    });
  }

  // Check if already rated
  const existingRating = await Rating.findOne({
    bookingId,
    ratedByRole: userRole
  });

  if (existingRating) {
    return res.status(200).json({
      success: true,
      canRate: false,
      reason: 'Already rated',
      rating: existingRating
    });
  }

  res.status(200).json({
    success: true,
    canRate: true,
    booking: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      completedAt: booking.timeline.completedAt
    }
  });
});

/**
 * Get user's given ratings
 * GET /api/v1/ratings/my-ratings
 */
exports.getMyRatings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [ratings, total] = await Promise.all([
    Rating.find({ ratedBy: req.userId })
      .populate('bookingId', 'bookingNumber createdAt')
      .populate('ratedDriver', 'userId vehicleDetails rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Rating.countDocuments({ ratedBy: req.userId })
  ]);

  res.status(200).json({
    success: true,
    data: {
      ratings: ratings.map(r => ({
        id: r._id,
        bookingNumber: r.bookingId?.bookingNumber,
        ratedRole: r.ratedByRole,
        driverRating: r.driverRating,
        userRating: r.userRating,
        createdAt: r.createdAt
      })),
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
 * DRIVER: Get my rating statistics and profile
 * GET /api/v1/ratings/my-stats
 */
exports.getMyStats = asyncHandler(async (req, res) => {
  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId })
    .select('rating userId vehicleDetails')
    .populate('userId', 'phoneNumber profile');

  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Get total ratings breakdown
  const ratings = await Rating.find({
    ratedDriver: driver._id,
    ratedByRole: 'user'
  });

  // Calculate additional stats
  let recentRatingsCount = 0;
  let last30DaysAvg = 0;

  if (ratings.length > 0) {
    // Get ratings from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRatings = ratings.filter(r => r.createdAt >= thirtyDaysAgo);
    recentRatingsCount = recentRatings.length;

    if (recentRatingsCount > 0) {
      const recentSum = recentRatings.reduce((sum, r) => sum + r.driverRating.overall, 0);
      last30DaysAvg = (recentSum / recentRatingsCount).toFixed(2);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      driver: {
        id: driver._id,
        phoneNumber: driver.userId.phoneNumber,
        profile: driver.userId.profile,
        vehicleDetails: driver.vehicleDetails
      },
      ratingStats: {
        overall: {
          average: driver.rating.average,
          totalRatings: driver.rating.totalRatings,
          last30DaysAverage: last30DaysAvg,
          last30DaysCount: recentRatingsCount
        },
        categories: {
          professionalism: driver.rating.professionalism,
          serviceQuality: driver.rating.serviceQuality,
          timeliness: driver.rating.timeliness,
          vehicleHandling: driver.rating.vehicleHandling
        },
        starDistribution: {
          fiveStars: driver.rating.fiveStars,
          fourStars: driver.rating.fourStars,
          threeStars: driver.rating.threeStars,
          twoStars: driver.rating.twoStars,
          oneStar: driver.rating.oneStar
        },
        percentages: {
          fiveStarPercent: driver.rating.totalRatings > 0
            ? ((driver.rating.fiveStars / driver.rating.totalRatings) * 100).toFixed(1)
            : 0,
          fourStarPercent: driver.rating.totalRatings > 0
            ? ((driver.rating.fourStars / driver.rating.totalRatings) * 100).toFixed(1)
            : 0,
          threeStarPercent: driver.rating.totalRatings > 0
            ? ((driver.rating.threeStars / driver.rating.totalRatings) * 100).toFixed(1)
            : 0,
          twoStarPercent: driver.rating.totalRatings > 0
            ? ((driver.rating.twoStars / driver.rating.totalRatings) * 100).toFixed(1)
            : 0,
          oneStarPercent: driver.rating.totalRatings > 0
            ? ((driver.rating.oneStar / driver.rating.totalRatings) * 100).toFixed(1)
            : 0
        }
      }
    }
  });
});

/**
 * DRIVER: Get my reviews (what users said about me)
 * GET /api/v1/ratings/my-reviews
 */
exports.getMyReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, minRating } = req.query;

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const query = {
    ratedDriver: driver._id,
    ratedByRole: 'user'
  };

  // Filter by minimum rating
  if (minRating) {
    query['driverRating.overall'] = { $gte: parseInt(minRating) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [ratings, total] = await Promise.all([
    Rating.find(query)
      .populate('ratedUser', 'phoneNumber profile')
      .populate('bookingId', 'bookingNumber createdAt completedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Rating.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: {
      reviews: ratings.map(r => ({
        id: r._id,
        booking: {
          bookingNumber: r.bookingId?.bookingNumber,
          completedAt: r.bookingId?.completedAt
        },
        user: {
          name: r.ratedUser?.profile?.firstName
            ? `${r.ratedUser.profile.firstName} ${r.ratedUser.profile.lastName || ''}`.trim()
            : 'User',
          phoneNumber: r.ratedUser?.phoneNumber
        },
        rating: {
          professionalism: r.driverRating.professionalism,
          serviceQuality: r.driverRating.serviceQuality,
          timeliness: r.driverRating.timeliness,
          vehicleHandling: r.driverRating.vehicleHandling,
          overall: r.driverRating.overall,
          feedback: r.driverRating.feedback,
          tags: r.driverRating.tags
        },
        createdAt: r.createdAt
      })),
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
 * Helper function to update driver rating statistics
 */
async function updateDriverRatingStats(driverId) {
  // Get all ratings for this driver
  const ratings = await Rating.find({
    ratedDriver: driverId,
    ratedByRole: 'user'
  });

  if (ratings.length === 0) return;

  // Calculate averages
  let totalOverall = 0;
  let totalProfessionalism = 0;
  let totalServiceQuality = 0;
  let totalTimeliness = 0;
  let totalVehicleHandling = 0;

  let profCount = 0, serviceCount = 0, timeCount = 0, vehicleCount = 0;

  // Star distribution
  const starDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  ratings.forEach(rating => {
    totalOverall += rating.driverRating.overall;

    // Round overall to nearest integer for star distribution
    const roundedRating = Math.round(rating.driverRating.overall);
    starDistribution[roundedRating]++;

    if (rating.driverRating.professionalism) {
      totalProfessionalism += rating.driverRating.professionalism;
      profCount++;
    }
    if (rating.driverRating.serviceQuality) {
      totalServiceQuality += rating.driverRating.serviceQuality;
      serviceCount++;
    }
    if (rating.driverRating.timeliness) {
      totalTimeliness += rating.driverRating.timeliness;
      timeCount++;
    }
    if (rating.driverRating.vehicleHandling) {
      totalVehicleHandling += rating.driverRating.vehicleHandling;
      vehicleCount++;
    }
  });

  // Update driver
  await Driver.findByIdAndUpdate(driverId, {
    'rating.average': (totalOverall / ratings.length).toFixed(2),
    'rating.totalRatings': ratings.length,
    'rating.professionalism': profCount > 0 ? (totalProfessionalism / profCount).toFixed(2) : 0,
    'rating.serviceQuality': serviceCount > 0 ? (totalServiceQuality / serviceCount).toFixed(2) : 0,
    'rating.timeliness': timeCount > 0 ? (totalTimeliness / timeCount).toFixed(2) : 0,
    'rating.vehicleHandling': vehicleCount > 0 ? (totalVehicleHandling / vehicleCount).toFixed(2) : 0,
    'rating.fiveStars': starDistribution[5],
    'rating.fourStars': starDistribution[4],
    'rating.threeStars': starDistribution[3],
    'rating.twoStars': starDistribution[2],
    'rating.oneStar': starDistribution[1]
  });

  console.log(`[UpdateDriverRating] Updated stats for driver ${driverId}`);
}

module.exports = exports;
