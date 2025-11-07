const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * ADMIN - Get All Drivers (with pagination, search, filters)
 */
exports.getAllDrivers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    approvalStatus,
    isOnline,
    vehicleType,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};

  // Approval status filter
  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  // Online status filter
  if (isOnline !== undefined) {
    query.isOnline = isOnline === 'true';
  }

  // Vehicle type filter
  if (vehicleType) {
    query['vehicleDetails.vehicleType'] = vehicleType;
  }

  // Search by vehicle number or driver name
  let drivers;
  if (search) {
    drivers = await Driver.find(query)
      .populate({
        path: 'userId',
        match: {
          $or: [
            { phoneNumber: { $regex: search, $options: 'i' } },
            { 'profile.firstName': { $regex: search, $options: 'i' } },
            { 'profile.lastName': { $regex: search, $options: 'i' } }
          ]
        },
        select: '-password -refreshToken'
      })
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Filter out drivers where userId didn't match search
    drivers = drivers.filter(d => d.userId);
  } else {
    drivers = await Driver.find(query)
      .populate('userId', '-password -refreshToken')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
  }

  const total = await Driver.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      drivers,
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
 * ADMIN - Get Driver by ID
 */
exports.getDriverById = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const driver = await Driver.findById(driverId)
    .populate('userId', '-password -refreshToken');

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Get driver statistics
  const totalTrips = await Booking.countDocuments({
    driverId: driver._id,
    status: 'completed'
  });

  const totalEarnings = await Booking.aggregate([
    {
      $match: {
        driverId: driver._id,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$driverEarnings' }
      }
    }
  ]);

  const cancelledTrips = await Booking.countDocuments({
    driverId: driver._id,
    status: 'cancelled_by_driver'
  });

  // Count rejected trips (trips driver cancelled/rejected)
  const rejectedTrips = await Booking.countDocuments({
    driverId: driver._id,
    status: 'cancelled_by_driver'
  });

  const activeBooking = await Booking.findOne({
    driverId: driver._id,
    status: { $in: ['accepted', 'payment_completed', 'driver_arrived', 'in_progress'] }
  });

  const stats = {
    totalTrips,
    totalEarnings: totalEarnings[0]?.total || 0,
    cancelledTrips,
    rejectedTrips,
    averageRating: driver.rating?.average || 0,
    totalRatings: driver.rating?.totalRatings || 0,
    hasActiveBooking: !!activeBooking
  };

  res.status(200).json({
    success: true,
    data: {
      driver,
      stats
    }
  });
});

/**
 * ADMIN - Update Driver Approval Status
 */
exports.updateDriverApproval = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { approvalStatus, rejectionReason } = req.body;

  if (!approvalStatus) {
    throw new ValidationError('Approval status is required');
  }

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  driver.approvalStatus = approvalStatus;

  if (approvalStatus === 'rejected' && rejectionReason) {
    driver.rejectionReason = rejectionReason;
  }

  if (approvalStatus === 'approved') {
    driver.approvedAt = new Date();
    driver.rejectionReason = null;
  }

  await driver.save();

  res.status(200).json({
    success: true,
    message: `Driver ${approvalStatus} successfully`,
    data: { driver }
  });
});

/**
 * ADMIN - Update Driver Details
 */
exports.updateDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const {
    vehicleDetails,
    bankDetails,
    isOnline,
    currentLocation
  } = req.body;

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Update vehicle details
  if (vehicleDetails) {
    driver.vehicleDetails = {
      ...driver.vehicleDetails,
      ...vehicleDetails
    };
  }

  // Update bank details
  if (bankDetails) {
    driver.bankDetails = {
      ...driver.bankDetails,
      ...bankDetails
    };
  }

  // Update online status
  if (typeof isOnline !== 'undefined') {
    driver.isOnline = isOnline;
  }

  // Update current location
  if (currentLocation) {
    driver.currentLocation = currentLocation;
  }

  await driver.save();

  res.status(200).json({
    success: true,
    message: 'Driver updated successfully',
    data: { driver }
  });
});

/**
 * ADMIN - Delete Driver (Soft delete)
 */
exports.deleteDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { hardDelete = false } = req.query;

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Check for active bookings
  const activeBooking = await Booking.findOne({
    driverId: driver._id,
    status: { $in: ['accepted', 'payment_completed', 'driver_arrived', 'in_progress'] }
  });

  if (activeBooking) {
    throw new ValidationError('Cannot delete driver with active bookings');
  }

  if (hardDelete === 'true') {
    // Hard delete
    await Driver.findByIdAndDelete(driverId);

    // Also deactivate user account
    await User.findByIdAndUpdate(driver.userId, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Driver permanently deleted'
    });
  } else {
    // Soft delete - mark as rejected/inactive
    driver.approvalStatus = 'rejected';
    driver.isOnline = false;
    await driver.save();

    // Deactivate user account
    await User.findByIdAndUpdate(driver.userId, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Driver deactivated successfully',
      data: { driver }
    });
  }
});

/**
 * ADMIN - Get Driver Earnings
 */
exports.getDriverEarnings = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { startDate, endDate } = req.query;

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Build date filter
  const dateFilter = {};
  if (startDate) {
    dateFilter.$gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.$lte = new Date(endDate);
  }

  const query = {
    driverId: driver._id,
    status: 'completed'
  };

  if (Object.keys(dateFilter).length > 0) {
    query['timeline.completedAt'] = dateFilter;
  }

  // Get completed bookings
  const bookings = await Booking.find(query)
    .select('bookingNumber pricing driverEarnings platformCommission timeline.completedAt')
    .sort({ 'timeline.completedAt': -1 });

  const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.driverEarnings || 0), 0);
  const totalCommission = bookings.reduce((sum, booking) => sum + (booking.platformCommission || 0), 0);

  res.status(200).json({
    success: true,
    data: {
      driverId: driver._id,
      totalEarnings,
      totalCommission,
      availableBalance: driver.earnings.availableBalance,
      totalWithdrawn: driver.earnings.totalWithdrawn,
      totalTrips: bookings.length,
      bookings
    }
  });
});

/**
 * ADMIN - Get Driver Statistics
 */
exports.getDriverStatistics = asyncHandler(async (req, res) => {
  const totalDrivers = await Driver.countDocuments();
  const approvedDrivers = await Driver.countDocuments({ approvalStatus: 'approved' });
  const pendingDrivers = await Driver.countDocuments({ approvalStatus: 'pending' });
  const rejectedDrivers = await Driver.countDocuments({ approvalStatus: 'rejected' });
  const onlineDrivers = await Driver.countDocuments({ isOnline: true, approvalStatus: 'approved' });

  // Get drivers by vehicle type
  const driversByVehicleType = await Driver.aggregate([
    {
      $group: {
        _id: '$vehicleDetails.vehicleType',
        count: { $sum: 1 }
      }
    }
  ]);

  // Recent drivers (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newDriversLast30Days = await Driver.countDocuments({
    createdAt: { $gte: thirtyDaysAgo }
  });

  res.status(200).json({
    success: true,
    data: {
      total: totalDrivers,
      approved: approvedDrivers,
      pending: pendingDrivers,
      rejected: rejectedDrivers,
      online: onlineDrivers,
      offline: approvedDrivers - onlineDrivers,
      newLast30Days: newDriversLast30Days,
      byVehicleType: driversByVehicleType
    }
  });
});

/**
 * ADMIN - Get Driver Documents
 */
exports.getDriverDocuments = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const driver = await Driver.findById(driverId)
    .select('documents vehicleDetails.photos')
    .populate('userId', 'phoneNumber profile');

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  res.status(200).json({
    success: true,
    data: {
      driverId: driver._id,
      documents: driver.documents,
      vehiclePhotos: driver.vehicleDetails?.photos || []
    }
  });
});

/**
 * ADMIN - Update Document Status
 */
exports.updateDocumentStatus = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { documentType, status, rejectionReason } = req.body;

  if (!documentType || !status) {
    throw new ValidationError('Document type and status are required');
  }

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Update specific document status
  if (driver.documents && driver.documents[documentType]) {
    driver.documents[documentType].status = status;
    driver.documents[documentType].verifiedAt = status === 'verified' ? new Date() : null;
    driver.documents[documentType].rejectionReason = status === 'rejected' ? rejectionReason : null;
  }

  await driver.save();

  res.status(200).json({
    success: true,
    message: 'Document status updated successfully',
    data: {
      documentType,
      status: driver.documents[documentType].status
    }
  });
});

/**
 * ADMIN - Get Driver Rejection Statistics
 */
exports.getDriverRejectionStats = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { startDate, endDate } = req.query;

  const driver = await Driver.findById(driverId)
    .populate('userId', 'phoneNumber profile');

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Build date filter
  const dateFilter = {
    driverId: driver._id,
    status: 'cancelled_by_driver'
  };

  if (startDate || endDate) {
    dateFilter['timeline.cancelledAt'] = {};
    if (startDate) {
      dateFilter['timeline.cancelledAt'].$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter['timeline.cancelledAt'].$lte = new Date(endDate);
    }
  }

  // Total rejections
  const totalRejections = await Booking.countDocuments(dateFilter);

  // Get all rejected bookings with details
  const rejectedBookings = await Booking.find(dateFilter)
    .populate('userId', 'phoneNumber profile')
    .select('bookingNumber status pickupLocation dropoffLocation pricing cancellationDetails timeline')
    .sort({ 'timeline.cancelledAt': -1 })
    .lean();

  // Group by rejection reason
  const rejectionsByReason = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$cancellationDetails.reason',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Rejection trend by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rejectionTrend = await Booking.aggregate([
    {
      $match: {
        driverId: driver._id,
        status: 'cancelled_by_driver',
        'timeline.cancelledAt': { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timeline.cancelledAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Calculate rejection rate
  const totalAcceptedTrips = await Booking.countDocuments({
    driverId: driver._id,
    status: { $in: ['accepted', 'payment_completed', 'driver_arrived', 'in_progress', 'completed', 'cancelled_by_driver'] }
  });

  const rejectionRate = totalAcceptedTrips > 0
    ? ((totalRejections / totalAcceptedTrips) * 100).toFixed(2)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      driver: {
        id: driver._id,
        name: driver.userId.profile?.firstName
          ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName || ''}`.trim()
          : 'Driver',
        phoneNumber: driver.userId.phoneNumber
      },
      rejectionStats: {
        totalRejections,
        rejectionRate: parseFloat(rejectionRate),
        totalAcceptedTrips
      },
      rejectionsByReason,
      rejectionTrend,
      rejectedBookings: rejectedBookings.slice(0, 20) // Latest 20 rejections
    }
  });
});

module.exports = exports;
