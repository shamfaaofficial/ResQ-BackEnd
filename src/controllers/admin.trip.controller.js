const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Transaction = require('../models/Transaction');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { BOOKING_STATUS } = require('../config/constants');

/**
 * ADMIN - Get All Trips (with pagination, search, filters)
 */
exports.getAllTrips = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    startDate,
    endDate,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};

  // Status filter
  if (status) {
    query.status = status;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Search by booking number
  if (search) {
    query.bookingNumber = { $regex: search, $options: 'i' };
  }

  // Execute query with pagination
  const trips = await Booking.find(query)
    .populate('userId', 'phoneNumber profile')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Booking.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      trips,
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
 * ADMIN - Get Trip by ID (Detailed)
 */
exports.getTripById = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await Booking.findById(tripId)
    .populate('userId', 'phoneNumber profile email')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    });

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  // Get payment transaction if exists
  const transaction = await Transaction.findOne({
    bookingId: trip._id,
    type: 'booking_payment'
  });

  res.status(200).json({
    success: true,
    data: {
      trip,
      transaction
    }
  });
});

/**
 * ADMIN - Get Trip Statistics
 */
exports.getTripStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Build date filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) {
      dateFilter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.createdAt.$lte = new Date(endDate);
    }
  }

  // Total trips
  const totalTrips = await Booking.countDocuments(dateFilter);

  // Trips by status
  const tripsByStatus = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Completed trips revenue
  const revenueData = await Booking.aggregate([
    {
      $match: {
        ...dateFilter,
        status: BOOKING_STATUS.COMPLETED
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        platformCommission: { $sum: '$platformCommission' },
        driverEarnings: { $sum: '$driverEarnings' },
        totalTrips: { $sum: 1 }
      }
    }
  ]);

  // Average trip value
  const avgTripValue = revenueData[0]?.totalRevenue / revenueData[0]?.totalTrips || 0;

  // Trips by vehicle type
  const tripsByVehicleType = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$vehicleType',
        count: { $sum: 1 }
      }
    }
  ]);

  // Daily trips (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyTrips = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Top 5 users by trips
  const topUsers = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$userId',
        tripCount: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' }
      }
    },
    { $sort: { tripCount: -1 } },
    { $limit: 5 }
  ]);

  // Populate user details for top users
  const topUsersDetails = await User.populate(topUsers, {
    path: '_id',
    select: 'phoneNumber profile'
  });

  // Top 5 drivers by trips
  const topDrivers = await Booking.aggregate([
    {
      $match: {
        ...dateFilter,
        status: BOOKING_STATUS.COMPLETED
      }
    },
    {
      $group: {
        _id: '$driverId',
        tripCount: { $sum: 1 },
        totalEarnings: { $sum: '$driverEarnings' }
      }
    },
    { $sort: { tripCount: -1 } },
    { $limit: 5 }
  ]);

  // Populate driver details
  const topDriversDetails = await Driver.populate(topDrivers, {
    path: '_id',
    populate: {
      path: 'userId',
      select: 'phoneNumber profile'
    }
  });

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalTrips,
        completedTrips: revenueData[0]?.totalTrips || 0,
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        platformCommission: revenueData[0]?.platformCommission || 0,
        driverEarnings: revenueData[0]?.driverEarnings || 0,
        avgTripValue: Math.round(avgTripValue * 100) / 100
      },
      tripsByStatus,
      tripsByVehicleType,
      dailyTrips,
      topUsers: topUsersDetails,
      topDrivers: topDriversDetails
    }
  });
});

/**
 * ADMIN - Cancel Trip
 */
exports.cancelTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { reason } = req.body;

  const trip = await Booking.findById(tripId);

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  // Check if trip can be cancelled
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER].includes(trip.status)) {
    throw new ValidationError('Trip cannot be cancelled');
  }

  trip.status = BOOKING_STATUS.CANCELLED_BY_USER;
  trip.cancellationDetails = {
    cancelledBy: 'admin',
    reason: reason || 'Cancelled by admin',
    cancelledAt: new Date()
  };
  trip.timeline.cancelledAt = new Date();
  await trip.save();

  // TODO: Process refund if payment was completed
  // if (trip.payment?.status === 'completed') {
  //   // Initiate refund
  // }

  res.status(200).json({
    success: true,
    message: 'Trip cancelled successfully',
    data: { trip }
  });
});

/**
 * ADMIN - Get Revenue Report
 */
exports.getRevenueReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  // Build date filter
  const dateFilter = {
    status: BOOKING_STATUS.COMPLETED
  };

  if (startDate || endDate) {
    dateFilter['timeline.completedAt'] = {};
    if (startDate) {
      dateFilter['timeline.completedAt'].$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter['timeline.completedAt'].$lte = new Date(endDate);
    }
  }

  // Determine grouping format
  let dateFormat;
  switch (groupBy) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-W%V';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'year':
      dateFormat = '%Y';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const revenueReport = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          $dateToString: { format: dateFormat, date: '$timeline.completedAt' }
        },
        totalTrips: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        platformCommission: { $sum: '$platformCommission' },
        driverEarnings: { $sum: '$driverEarnings' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Calculate totals
  const totals = revenueReport.reduce(
    (acc, item) => ({
      totalTrips: acc.totalTrips + item.totalTrips,
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      platformCommission: acc.platformCommission + item.platformCommission,
      driverEarnings: acc.driverEarnings + item.driverEarnings
    }),
    { totalTrips: 0, totalRevenue: 0, platformCommission: 0, driverEarnings: 0 }
  );

  res.status(200).json({
    success: true,
    data: {
      report: revenueReport,
      totals,
      period: {
        startDate,
        endDate,
        groupBy
      }
    }
  });
});

/**
 * ADMIN - Get Active Trips (Real-time)
 */
exports.getActiveTrips = asyncHandler(async (req, res) => {
  const activeTrips = await Booking.find({
    status: {
      $in: [
        BOOKING_STATUS.REQUESTED,
        BOOKING_STATUS.ACCEPTED,
        BOOKING_STATUS.PAYMENT_COMPLETED,
        BOOKING_STATUS.DRIVER_ARRIVED,
        BOOKING_STATUS.IN_PROGRESS
      ]
    }
  })
    .populate('userId', 'phoneNumber profile')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: {
      activeTrips,
      count: activeTrips.length
    }
  });
});

/**
 * ADMIN - Get Trip Timeline
 */
exports.getTripTimeline = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await Booking.findById(tripId)
    .select('bookingNumber status timeline verificationCode payment')
    .lean();

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  // Build timeline events
  const timelineEvents = [];

  if (trip.timeline.requestedAt) {
    timelineEvents.push({
      event: 'Trip Requested',
      timestamp: trip.timeline.requestedAt,
      status: BOOKING_STATUS.REQUESTED
    });
  }

  if (trip.timeline.acceptedAt) {
    timelineEvents.push({
      event: 'Driver Accepted',
      timestamp: trip.timeline.acceptedAt,
      status: BOOKING_STATUS.ACCEPTED
    });
  }

  if (trip.timeline.paymentCompletedAt) {
    timelineEvents.push({
      event: 'Payment Completed',
      timestamp: trip.timeline.paymentCompletedAt,
      status: BOOKING_STATUS.PAYMENT_COMPLETED,
      details: {
        transactionId: trip.payment?.transactionId,
        amount: trip.payment?.paidAmount
      }
    });
  }

  if (trip.timeline.driverArrivedAt) {
    timelineEvents.push({
      event: 'Driver Arrived at Pickup',
      timestamp: trip.timeline.driverArrivedAt,
      status: BOOKING_STATUS.DRIVER_ARRIVED,
      details: {
        verificationCode: trip.verificationCode?.code,
        verifiedAt: trip.verificationCode?.verifiedAt
      }
    });
  }

  if (trip.timeline.startedAt) {
    timelineEvents.push({
      event: 'Trip Started',
      timestamp: trip.timeline.startedAt,
      status: BOOKING_STATUS.IN_PROGRESS
    });
  }

  if (trip.timeline.completedAt) {
    timelineEvents.push({
      event: 'Trip Completed',
      timestamp: trip.timeline.completedAt,
      status: BOOKING_STATUS.COMPLETED
    });
  }

  if (trip.timeline.cancelledAt) {
    timelineEvents.push({
      event: 'Trip Cancelled',
      timestamp: trip.timeline.cancelledAt,
      status: trip.status
    });
  }

  res.status(200).json({
    success: true,
    data: {
      bookingNumber: trip.bookingNumber,
      currentStatus: trip.status,
      timeline: timelineEvents
    }
  });
});

/**
 * ADMIN - Update Trip Status (Force update)
 */
exports.updateTripStatus = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { status, reason } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const trip = await Booking.findById(tripId);

  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  const oldStatus = trip.status;
  trip.status = status;

  // Update timeline based on new status
  switch (status) {
    case BOOKING_STATUS.CANCELLED_BY_USER:
    case BOOKING_STATUS.CANCELLED_BY_DRIVER:
      trip.timeline.cancelledAt = new Date();
      trip.cancellationDetails = {
        cancelledBy: 'admin',
        reason: reason || 'Status updated by admin',
        cancelledAt: new Date()
      };
      break;
    case BOOKING_STATUS.COMPLETED:
      trip.timeline.completedAt = new Date();
      break;
  }

  await trip.save();

  res.status(200).json({
    success: true,
    message: `Trip status updated from ${oldStatus} to ${status}`,
    data: { trip }
  });
});

module.exports = exports;
