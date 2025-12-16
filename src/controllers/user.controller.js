const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { hashPassword } = require('../utils/helpers');

// Get user profile
exports.getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('-password -refreshTokens');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        username: user.username,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        profile: user.profile,
        wallet: user.wallet,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Update user profile
exports.updateUserProfile = asyncHandler(async (req, res) => {
  const {
    username,
    firstName,
    lastName,
    email,
    profileImage
  } = req.body;

  const user = await User.findById(req.userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Update username if provided
  if (username) {
    // Check if username is already taken by another user
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
      _id: { $ne: req.userId }
    });

    if (existingUser) {
      throw new ValidationError('Username is already taken');
    }

    user.username = username.toLowerCase();
  }

  // Update profile fields
  if (firstName !== undefined) user.profile.firstName = firstName;
  if (lastName !== undefined) user.profile.lastName = lastName;
  if (email !== undefined) {
    // Check if email is already taken by another user
    if (email) {
      const existingEmail = await User.findOne({
        'profile.email': email.toLowerCase(),
        _id: { $ne: req.userId }
      });

      if (existingEmail) {
        throw new ValidationError('Email is already taken');
      }
    }
    user.profile.email = email ? email.toLowerCase() : null;
  }
  if (profileImage !== undefined) user.profile.profileImage = profileImage;

  await user.save();

  // Return updated user without sensitive data
  const updatedUser = await User.findById(req.userId).select('-password -refreshTokens');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        _id: updatedUser._id,
        phoneNumber: updatedUser.phoneNumber,
        countryCode: updatedUser.countryCode,
        username: updatedUser.username,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        isActive: updatedUser.isActive,
        profile: updatedUser.profile,
        wallet: updatedUser.wallet,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    }
  });
});

// Get wallet balance
exports.getWalletBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('wallet');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.status(200).json({
    success: true,
    data: {
      wallet: user.wallet
    }
  });
});

// Get wallet with user info (for display screen)
exports.getWalletWithUserInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('profile.firstName profile.lastName wallet phoneNumber');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.status(200).json({
    success: true,
    data: {
      name: `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || 'User',
      phoneNumber: user.phoneNumber,
      wallet: {
        balance: user.wallet.balance,
        currency: user.wallet.currency,
        lastUpdated: user.wallet.lastUpdated
      }
    }
  });
});

// Update wallet balance (Admin only - for adding credits)
exports.updateWalletBalance = asyncHandler(async (req, res) => {
  const { amount, operation } = req.body;

  if (!amount || typeof amount !== 'number') {
    throw new ValidationError('Amount must be a valid number');
  }

  if (amount <= 0) {
    throw new ValidationError('Amount must be greater than 0');
  }

  if (!operation || !['add', 'deduct'].includes(operation)) {
    throw new ValidationError('Operation must be either "add" or "deduct"');
  }

  const user = await User.findById(req.userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Perform operation
  if (operation === 'add') {
    user.wallet.balance += amount;
  } else if (operation === 'deduct') {
    if (user.wallet.balance < amount) {
      throw new ValidationError('Insufficient wallet balance');
    }
    user.wallet.balance -= amount;
  }

  user.wallet.lastUpdated = new Date();
  await user.save();

  res.status(200).json({
    success: true,
    message: `Wallet ${operation === 'add' ? 'credited' : 'debited'} successfully`,
    data: {
      wallet: {
        balance: user.wallet.balance,
        currency: user.wallet.currency,
        lastUpdated: user.wallet.lastUpdated
      },
      transaction: {
        amount: amount,
        operation: operation,
        previousBalance: operation === 'add' ? user.wallet.balance - amount : user.wallet.balance + amount,
        newBalance: user.wallet.balance
      }
    }
  });
});

// Change password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters long');
  }

  // Get user with password field
  const user = await User.findById(req.userId).select('+password');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const bcrypt = require('bcryptjs');
  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw new ValidationError('Current password is incorrect');
  }

  // Hash and save new password
  user.password = await hashPassword(newPassword);
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Delete account
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new ValidationError('Password is required to delete account');
  }

  // Get user with password field
  const user = await User.findById(req.userId).select('+password');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify password
  const bcrypt = require('bcryptjs');
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ValidationError('Incorrect password');
  }

  // Soft delete - deactivate account instead of hard delete
  user.isActive = false;
  user.refreshTokens = [];
  user.fcmToken = null;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Get user ride history
exports.getRideHistory = asyncHandler(async (req, res) => {
  const Booking = require('../models/Booking');
  const { BOOKING_STATUS, PAGINATION } = require('../config/constants');

  const user = await User.findById(req.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

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
  const query = { userId: req.userId };

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
    // Default: Show only completed trips
    query.status = BOOKING_STATUS.COMPLETED;
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
  const validSortFields = ['createdAt', 'completedAt', 'totalAmount'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

  // Map sortBy to actual field paths
  const sortFieldMap = {
    'createdAt': 'createdAt',
    'completedAt': 'timeline.completedAt',
    'totalAmount': 'pricing.totalAmount'
  };

  sortConfig[sortFieldMap[sortField]] = sortOrder === 'asc' ? 1 : -1;

  // Execute queries in parallel
  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .populate('driverId', 'vehicleDetails currentLocation userId')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'phoneNumber profile'
        }
      })
      .select('-__v -verificationCode')
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query)
  ]);

  // CRITICAL: Filter out driver details for bookings where payment is not completed
  // AND generate signed URLs for driver profile images
  const { PAYMENT_STATUS } = require('../config/constants');
  const { extractS3Key, getSignedFileUrl } = require('../config/s3');

  const filteredBookings = await Promise.all(bookings.map(async (booking) => {
    if (booking.payment?.status !== PAYMENT_STATUS.COMPLETED) {
      // Remove driver details if payment not completed
      return {
        ...booking,
        driverId: null
      };
    }

    // Generate signed URL for driver profile image
    if (booking.driverId?.userId?.profile?.profileImage) {
      try {
        const s3Key = extractS3Key(booking.driverId.userId.profile.profileImage);
        const signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
        booking.driverId.userId.profile.profileImageSignedUrl = signedUrl;
      } catch (error) {
        console.error('[GetRideHistory] Failed to generate signed URL for driver profile:', error.message);
        // Continue without signed URL - don't fail the request
      }
    }

    return booking;
  }));

  // Calculate statistics
  const mongoose = require('mongoose');
  const stats = await Booking.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
              '$pricing.totalAmount',
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
    totalSpent: stats.find(s => s._id === BOOKING_STATUS.COMPLETED)?.totalSpent || 0,
    totalTrips: stats.reduce((sum, s) => sum + s.count, 0)
  };

  res.status(200).json({
    success: true,
    data: {
      rides: filteredBookings,
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
