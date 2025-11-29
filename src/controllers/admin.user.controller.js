const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const { hashPassword } = require('../utils/helpers');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * ADMIN - Get All Users (with pagination, search, filters)
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    role,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};

  // Role filter
  if (role) {
    query.role = role;
  }

  // Search by phone number or name
  if (search) {
    query.$or = [
      { phoneNumber: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const users = await User.find(query)
    .select('-password -refreshToken')
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      users,
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
 * ADMIN - Get User by ID
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Get additional stats if user
  let stats = null;
  if (user.role === 'user') {
    const totalBookings = await Booking.countDocuments({ userId: user._id });
    const completedBookings = await Booking.countDocuments({
      userId: user._id,
      status: 'completed'
    });
    const cancelledBookings = await Booking.countDocuments({
      userId: user._id,
      status: { $in: ['cancelled_by_user', 'cancelled_by_driver', 'expired'] }
    });

    stats = {
      totalBookings,
      completedBookings,
      cancelledBookings
    };
  }

  // Get driver profile if exists
  let driverProfile = null;
  if (user.role === 'driver') {
    driverProfile = await Driver.findOne({ userId: user._id });
  }

  res.status(200).json({
    success: true,
    data: {
      user,
      stats,
      driverProfile
    }
  });
});

/**
 * ADMIN - Create New User
 */
exports.createUser = asyncHandler(async (req, res) => {
  const {
    phoneNumber,
    password,
    role = 'user',
    profile
  } = req.body;

  // Validate required fields
  if (!phoneNumber || !password) {
    throw new ValidationError('Phone number and password are required');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ phoneNumber });
  if (existingUser) {
    throw new ValidationError('User with this phone number already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await User.create({
    phoneNumber,
    password: hashedPassword,
    role,
    profile: profile || {}
  });

  // Remove sensitive data
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.refreshToken;

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: userResponse }
  });
});

/**
 * ADMIN - Update User
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const {
    phoneNumber,
    password,
    role,
    profile,
    isActive
  } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Update phone number if provided
  if (phoneNumber && phoneNumber !== user.phoneNumber) {
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      throw new ValidationError('Phone number already in use');
    }
    user.phoneNumber = phoneNumber;
  }

  // Update password if provided
  if (password) {
    user.password = await hashPassword(password);
  }

  // Update role if provided
  if (role) {
    user.role = role;
  }

  // Update profile if provided
  if (profile) {
    user.profile = {
      ...user.profile,
      ...profile
    };
  }

  // Update active status if provided
  if (typeof isActive !== 'undefined') {
    user.isActive = isActive;
  }

  await user.save();

  // Remove sensitive data
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.refreshToken;

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user: userResponse }
  });
});

/**
 * ADMIN - Delete User (Soft delete - mark as inactive)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { hardDelete = false } = req.query;

  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (hardDelete === 'true') {
    // Hard delete - permanently remove user
    await User.findByIdAndDelete(userId);

    // Also delete driver profile if exists
    await Driver.findOneAndDelete({ userId });

    res.status(200).json({
      success: true,
      message: 'User permanently deleted'
    });
  } else {
    // Soft delete - mark as inactive
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: { user: { id: user._id, isActive: user.isActive } }
    });
  }
});

/**
 * ADMIN - Get User Statistics
 */
exports.getUserStatistics = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments({ role: 'user' });
  const activeUsers = await User.countDocuments({ role: 'user', isActive: true });
  const totalDrivers = await User.countDocuments({ role: 'driver' });
  const activeDrivers = await User.countDocuments({ role: 'driver', isActive: true });
  const totalAdmins = await User.countDocuments({ role: 'admin' });

  // Get recent users (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newUsersLast30Days = await User.countDocuments({
    role: 'user',
    createdAt: { $gte: thirtyDaysAgo }
  });

  const newDriversLast30Days = await User.countDocuments({
    role: 'driver',
    createdAt: { $gte: thirtyDaysAgo }
  });

  res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        newLast30Days: newUsersLast30Days
      },
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
        inactive: totalDrivers - activeDrivers,
        newLast30Days: newDriversLast30Days
      },
      admins: {
        total: totalAdmins
      }
    }
  });
});

module.exports = exports;
