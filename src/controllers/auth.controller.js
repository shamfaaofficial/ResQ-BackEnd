const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Driver = require('../models/Driver');
const otpService = require('../services/otp.service');
const smsService = require('../services/sms.service');
const { generateAccessToken, generateRefreshToken, hashPassword, comparePassword } = require('../utils/helpers');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { OTP_PURPOSE } = require('../config/constants');

/**
 * USER AUTHENTICATION
 */

// Send OTP for user signup
exports.userSignup = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ phoneNumber });
  if (existingUser) {
    throw new ValidationError('User with this phone number already exists');
  }

  // Generate OTP
  const { otpCode } = await otpService.generateOTP(phoneNumber, OTP_PURPOSE.SIGNUP);

  // Send OTP via SMS
  await smsService.sendOTP(phoneNumber, otpCode);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '5 minutes'
    }
  });
});

// Verify OTP only
exports.userVerifyOTP = asyncHandler(async (req, res) => {
  console.log('📱 [userVerifyOTP] Request received');
  console.log('📱 [userVerifyOTP] Request body:', JSON.stringify(req.body));

  const { phoneNumber, otp } = req.body;

  // Validate required fields
  if (!phoneNumber || !otp) {
    console.log('❌ [userVerifyOTP] Missing required fields');
    throw new ValidationError('Phone number and OTP are required');
  }

  console.log('📱 [userVerifyOTP] Extracted phoneNumber:', phoneNumber);
  console.log('📱 [userVerifyOTP] Extracted OTP:', otp);
  console.log('📱 [userVerifyOTP] OTP Purpose:', OTP_PURPOSE.SIGNUP);

  // Verify OTP
  console.log('🔍 [userVerifyOTP] Calling otpService.verifyOTP...');
  const isValid = await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.SIGNUP);
  console.log('🔍 [userVerifyOTP] OTP verification result:', isValid);

  if (!isValid) {
    console.log('❌ [userVerifyOTP] OTP verification failed');
    throw new ValidationError('Invalid or expired OTP');
  }

  console.log('✅ [userVerifyOTP] OTP verified successfully');
  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      phoneNumber,
      verified: true
    }
  });
});

// Complete user signup after OTP verification
exports.userCompleteSignup = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

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
    role: 'user',
    isVerified: true,
    isActive: true
  });

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);

  // Save refresh token
  user.refreshTokens = [{ token: refreshToken }];
  await user.save();

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
});

// User login
exports.userLogin = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    throw new ValidationError('Phone number and password are required');
  }

  // Find user (include password for verification)
  const user = await User.findOne({ phoneNumber, role: 'user' }).select('+password');
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);

  // Clean expired tokens and add new refresh token
  user.cleanExpiredTokens();
  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
});

// Forgot password - send OTP
exports.userForgotPassword = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }

  // Check if user exists
  const user = await User.findOne({ phoneNumber, role: 'user' });
  if (!user) {
    throw new ValidationError('No user found with this phone number');
  }

  // Generate OTP
  const { otpCode } = await otpService.generateOTP(phoneNumber, OTP_PURPOSE.PASSWORD_RESET);

  // Send OTP via SMS
  await smsService.sendOTP(phoneNumber, otpCode);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully for password reset',
    data: {
      phoneNumber,
      expiresIn: '5 minutes'
    }
  });
});

// Reset password with OTP
exports.userResetPassword = asyncHandler(async (req, res) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!phoneNumber || !otp || !newPassword) {
    throw new ValidationError('All fields are required');
  }

  // Verify OTP
  const isValid = await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.PASSWORD_RESET);
  if (!isValid) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Find user
  const user = await User.findOne({ phoneNumber, role: 'user' });
  if (!user) {
    throw new ValidationError('User not found');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  user.password = hashedPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully'
  });
});

// Refresh access token
exports.userRefreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  // Find user and verify refresh token matches
  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if refresh token exists in user's tokens array
  const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
  if (!tokenExists) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Generate new access token
  const accessToken = generateAccessToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'Access token refreshed successfully',
    data: {
      accessToken
    }
  });
});

/**
 * DRIVER AUTHENTICATION
 */

// Send OTP for driver signup
exports.driverSignup = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }

  // Check if driver already exists
  const existingDriver = await Driver.findOne({ phoneNumber });
  if (existingDriver) {
    throw new ValidationError('Driver with this phone number already exists');
  }

  // Generate OTP
  const { otpCode } = await otpService.generateOTP(phoneNumber, OTP_PURPOSE.SIGNUP);

  // Send OTP via SMS
  await smsService.sendOTP(phoneNumber, otpCode);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '5 minutes'
    }
  });
});

// Verify OTP only
exports.driverVerifyOTP = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  // Validate required fields
  if (!phoneNumber || !otp) {
    throw new ValidationError('Phone number and OTP are required');
  }

  // Verify OTP
  const isValid = await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.SIGNUP);
  if (!isValid) {
    throw new ValidationError('Invalid or expired OTP');
  }

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      phoneNumber,
      verified: true
    }
  });
});

// Complete driver signup after OTP verification
exports.driverCompleteSignup = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

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

  // Create user with driver role
  const user = await User.create({
    phoneNumber,
    password: hashedPassword,
    role: 'driver',
    isVerified: true,
    isActive: true
  });

  // Create driver profile linked to user
  const driver = await Driver.create({
    userId: user._id,
    approvalStatus: 'pending'
  });

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);

  // Save refresh token
  user.refreshTokens = [{ token: refreshToken }];
  await user.save();

  res.status(201).json({
    success: true,
    message: 'Driver account created successfully. Please submit your documents for verification.',
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role
      },
      driver: {
        id: driver._id,
        approvalStatus: driver.approvalStatus
      },
      accessToken,
      refreshToken
    }
  });
});

// Driver login
exports.driverLogin = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    throw new ValidationError('Phone number and password are required');
  }

  // Find user with driver role (include password for verification)
  const user = await User.findOne({ phoneNumber, role: 'driver' }).select('+password');
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Find driver profile
  const driver = await Driver.findOne({ userId: user._id });

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);

  // Clean expired tokens and add new refresh token
  user.cleanExpiredTokens();
  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role
      },
      driver: driver ? {
        id: driver._id,
        approvalStatus: driver.approvalStatus,
        isOnline: driver.isOnline
      } : null,
      accessToken,
      refreshToken
    }
  });
});

// Forgot password - send OTP
exports.driverForgotPassword = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }

  // Check if user with driver role exists
  const user = await User.findOne({ phoneNumber, role: 'driver' });
  if (!user) {
    throw new ValidationError('No driver found with this phone number');
  }

  // Generate OTP
  const { otpCode } = await otpService.generateOTP(phoneNumber, OTP_PURPOSE.PASSWORD_RESET);

  // Send OTP via SMS
  await smsService.sendOTP(phoneNumber, otpCode);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully for password reset',
    data: {
      phoneNumber,
      expiresIn: '5 minutes'
    }
  });
});

// Reset password with OTP
exports.driverResetPassword = asyncHandler(async (req, res) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!phoneNumber || !otp || !newPassword) {
    throw new ValidationError('All fields are required');
  }

  // Verify OTP
  const isValid = await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.PASSWORD_RESET);
  if (!isValid) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Find user with driver role
  const user = await User.findOne({ phoneNumber, role: 'driver' });
  if (!user) {
    throw new ValidationError('Driver not found');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  user.password = hashedPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully'
  });
});

// Refresh access token
exports.driverRefreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  // Find user (driver) and verify refresh token matches
  const user = await User.findById(decoded.userId);
  if (!user || user.role !== 'driver') {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if refresh token exists in user's tokens array
  const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
  if (!tokenExists) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Generate new access token
  const accessToken = generateAccessToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'Access token refreshed successfully',
    data: {
      accessToken
    }
  });
});

// Submit driver documents
exports.driverSubmitDocuments = asyncHandler(async (req, res) => {
  const fileUploadService = require('../services/fileUpload.service');
  const {
    vehicleType,
    vehicleNumber,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor
  } = req.body;

  // Validate required fields
  if (!vehicleType || !vehicleNumber || !vehicleMake || !vehicleModel) {
    throw new ValidationError('All vehicle details are required');
  }

  // Check if all required documents are uploaded
  const requiredDocs = ['drivingLicense', 'vehicleRegistration', 'insurance', 'nationalId'];
  const missingDocs = requiredDocs.filter(doc => !req.files[doc]);

  if (missingDocs.length > 0) {
    throw new ValidationError(`Missing documents: ${missingDocs.join(', ')}`);
  }

  // Find driver
  const driver = await Driver.findById(req.userId);
  if (!driver) {
    throw new ValidationError('Driver not found');
  }

  try {
    // Upload documents to Cloudinary
    const uploadedDocs = {};

    for (const docType of requiredDocs) {
      const file = req.files[docType][0];
      const result = await fileUploadService.uploadDriverDocument(file, docType, driver._id);
      uploadedDocs[docType] = {
        url: result.url,
        publicId: result.publicId,
        status: 'pending'
      };
    }

    // Update driver with vehicle details and documents
    driver.vehicleDetails = {
      type: vehicleType,
      number: vehicleNumber,
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor
    };

    driver.documents = {
      drivingLicense: uploadedDocs.drivingLicense,
      vehicleRegistration: uploadedDocs.vehicleRegistration,
      insurance: uploadedDocs.insurance,
      nationalId: uploadedDocs.nationalId
    };

    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Documents submitted successfully. Your account is under review.',
      data: {
        driver: {
          id: driver._id,
          approvalStatus: driver.approvalStatus,
          vehicleDetails: driver.vehicleDetails,
          documentsSubmitted: true
        }
      }
    });
  } catch (error) {
    throw new Error(`Document upload failed: ${error.message}`);
  }
});

/**
 * ADMIN AUTHENTICATION (Placeholder - to be fully implemented)
 */

exports.adminLogin = asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, message: 'Admin login - to be implemented' });
});

/**
 * LOGOUT
 */

exports.logout = asyncHandler(async (req, res) => {
  // Clear refresh token
  const user = await User.findById(req.userId);
  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * FCM TOKEN MANAGEMENT
 */

// Update FCM token for user or driver
exports.updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;

  if (!fcmToken) {
    throw new ValidationError('FCM token is required');
  }

  const userId = req.userId;
  const userRole = req.userRole;

  // Update user's FCM token
  const user = await User.findById(userId);
  if (!user) {
    throw new ValidationError('User not found');
  }

  user.fcmToken = fcmToken;
  await user.save();

  // If driver, also update driver's FCM token
  if (userRole === 'driver') {
    const driver = await Driver.findOne({ userId });
    if (driver) {
      driver.fcmToken = fcmToken;
      await driver.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'FCM token updated successfully'
  });
});

// Remove FCM token (on logout or token invalidation)
exports.removeFcmToken = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const userRole = req.userRole;

  const user = await User.findById(userId);
  if (user) {
    user.fcmToken = null;
    await user.save();
  }

  if (userRole === 'driver') {
    const driver = await Driver.findOne({ userId });
    if (driver) {
      driver.fcmToken = null;
      await driver.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'FCM token removed successfully'
  });
});
