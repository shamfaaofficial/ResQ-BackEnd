const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { BOOKING_STATUS } = require('../config/constants');

/**
 * ADMIN - Get Dashboard Statistics
 * GET /api/v1/admin/dashboard/stats
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // Get current date ranges
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Parallel queries for better performance
  const [
    // Users
    totalUsers,
    activeUsersToday,
    newUsersThisMonth,
    newUsersLastMonth,

    // Drivers
    totalDrivers,
    onlineDrivers,
    approvedDrivers,
    pendingDrivers,
    rejectedDrivers,

    // Bookings/Trips
    totalBookings,
    todayBookings,
    thisWeekBookings,
    thisMonthBookings,
    completedBookings,
    cancelledBookings,
    inProgressBookings,
    requestedBookings,

    // Revenue
    totalRevenue,
    todayRevenue,
    thisWeekRevenue,
    thisMonthRevenue,
    platformCommission,

    // Recent activity
    recentBookings
  ] = await Promise.all([
    // Users counts
    User.countDocuments({ role: 'user' }),
    User.countDocuments({
      role: 'user',
      lastActiveAt: { $gte: startOfToday }
    }),
    User.countDocuments({
      role: 'user',
      createdAt: { $gte: startOfMonth }
    }),
    User.countDocuments({
      role: 'user',
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    }),

    // Drivers counts
    Driver.countDocuments(),
    Driver.countDocuments({ isOnline: true, approvalStatus: 'approved' }),
    Driver.countDocuments({ approvalStatus: 'approved' }),
    Driver.countDocuments({ approvalStatus: 'pending' }),
    Driver.countDocuments({ approvalStatus: 'rejected' }),

    // Bookings counts
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: startOfToday } }),
    Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Booking.countDocuments({ status: BOOKING_STATUS.COMPLETED }),
    Booking.countDocuments({
      status: { $in: [BOOKING_STATUS.CANCELLED_BY_USER, BOOKING_STATUS.CANCELLED_BY_DRIVER] }
    }),
    Booking.countDocuments({ status: BOOKING_STATUS.IN_PROGRESS }),
    Booking.countDocuments({ status: BOOKING_STATUS.REQUESTED }),

    // Revenue aggregations
    Booking.aggregate([
      { $match: { status: BOOKING_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: BOOKING_STATUS.COMPLETED,
          'timeline.completedAt': { $gte: startOfToday }
        }
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: BOOKING_STATUS.COMPLETED,
          'timeline.completedAt': { $gte: startOfWeek }
        }
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: BOOKING_STATUS.COMPLETED,
          'timeline.completedAt': { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]),
    Transaction.aggregate([
      { $match: { type: 'platform_commission' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),

    // Recent bookings (last 10)
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('bookingNumber status userId driverId pricing createdAt')
      .lean()
  ]);

  // Calculate growth percentage
  const userGrowth = newUsersLastMonth > 0
    ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
    : newUsersThisMonth > 0 ? 100 : 0;

  // Calculate available drivers (online + approved)
  const availableDrivers = onlineDrivers;

  // Extract revenue values
  const totalRevenueAmount = totalRevenue[0]?.total || 0;
  const todayRevenueAmount = todayRevenue[0]?.total || 0;
  const thisWeekRevenueAmount = thisWeekRevenue[0]?.total || 0;
  const thisMonthRevenueAmount = thisMonthRevenue[0]?.total || 0;
  const platformCommissionAmount = platformCommission[0]?.total || 0;
  const driverEarningsAmount = totalRevenueAmount - platformCommissionAmount;

  // Get popular pickup locations
  const popularLocations = await Booking.aggregate([
    { $match: { status: BOOKING_STATUS.COMPLETED } },
    {
      $group: {
        _id: '$pickupLocation.address',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        address: '$_id',
        count: 1,
        type: { $literal: 'pickup' }
      }
    }
  ]);

  // Format recent activity
  const recentActivity = recentBookings.map(booking => ({
    type: booking.status === BOOKING_STATUS.COMPLETED ? 'trip_completed' :
          booking.status === BOOKING_STATUS.CANCELLED_BY_USER ? 'trip_cancelled_user' :
          booking.status === BOOKING_STATUS.CANCELLED_BY_DRIVER ? 'trip_cancelled_driver' :
          'trip_' + booking.status,
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    userId: booking.userId,
    driverId: booking.driverId,
    amount: booking.pricing?.totalAmount || 0,
    timestamp: booking.createdAt
  }));

  // Build response
  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalDrivers,
        totalTrips: totalBookings,
        totalRevenue: parseFloat(totalRevenueAmount.toFixed(2)),
        activeTrips: inProgressBookings,
        pendingApprovals: pendingDrivers
      },
      users: {
        total: totalUsers,
        activeToday: activeUsersToday,
        newThisMonth: newUsersThisMonth,
        growth: parseFloat(userGrowth)
      },
      drivers: {
        total: totalDrivers,
        online: onlineDrivers,
        approved: approvedDrivers,
        pending: pendingDrivers,
        rejected: rejectedDrivers,
        availableNow: availableDrivers
      },
      trips: {
        total: totalBookings,
        today: todayBookings,
        thisWeek: thisWeekBookings,
        thisMonth: thisMonthBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        inProgress: inProgressBookings,
        requested: requestedBookings
      },
      revenue: {
        total: parseFloat(totalRevenueAmount.toFixed(2)),
        today: parseFloat(todayRevenueAmount.toFixed(2)),
        thisWeek: parseFloat(thisWeekRevenueAmount.toFixed(2)),
        thisMonth: parseFloat(thisMonthRevenueAmount.toFixed(2)),
        platformCommission: parseFloat(platformCommissionAmount.toFixed(2)),
        driverEarnings: parseFloat(driverEarningsAmount.toFixed(2))
      },
      recentActivity,
      popularLocations,
      timestamp: new Date().toISOString()
    }
  });
});
