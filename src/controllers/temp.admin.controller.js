const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { hashPassword } = require('../utils/helpers');
const { ROLES } = require('../config/constants');
const { ValidationError } = require('../utils/errors');

/**
 * TEMPORARY ENDPOINT - DELETE AFTER USE
 * Create admin user via API call
 * POST /api/v1/temp/create-admin
 */
exports.createAdmin = asyncHandler(async (req, res) => {
  const { username, password, firstName, lastName, phoneNumber, email, secretKey } = req.body;

  // Simple secret key protection (change this to something unique)
  const TEMP_SECRET = 'resq_temp_admin_creation_2025';

  if (secretKey !== TEMP_SECRET) {
    throw new ValidationError('Invalid secret key');
  }

  // Validate required fields
  if (!username || !password || !firstName || !lastName || !phoneNumber) {
    throw new ValidationError('Username, password, firstName, lastName, and phoneNumber are required');
  }

  // Check if admin already exists
  const existingAdmin = await User.findOne({
    $or: [
      { username },
      { phoneNumber }
    ]
  });

  if (existingAdmin) {
    return res.status(400).json({
      success: false,
      message: 'Admin already exists with this username or phone number',
      data: {
        existingUsername: existingAdmin.username,
        existingPhone: existingAdmin.phoneNumber,
        existingRole: existingAdmin.role
      }
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create admin user
  const admin = await User.create({
    username,
    password: hashedPassword,
    phoneNumber,
    role: ROLES.ADMIN,
    isVerified: true,
    isActive: true,
    profile: {
      firstName,
      lastName,
      email: email || undefined
    }
  });

  res.status(201).json({
    success: true,
    message: 'Admin user created successfully',
    data: {
      id: admin._id,
      username: admin.username,
      phoneNumber: admin.phoneNumber,
      role: admin.role,
      firstName: admin.profile.firstName,
      lastName: admin.profile.lastName,
      email: admin.profile.email,
      isActive: admin.isActive,
      isVerified: admin.isVerified
    }
  });
});

module.exports = exports;
