const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Driver = require('../models/Driver');
const otpService = require('../services/otp.service');
const smsService = require('../services/sms.service');
const twilioVerifyService = require('../services/twilioVerify.service');
const { generateAccessToken, generateRefreshToken, hashPassword, comparePassword, cleanPhoneNumber } = require('../utils/helpers');
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

  // Send OTP using Twilio Verify API
  const result = await twilioVerifyService.sendOTP(phoneNumber, 'sms');

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '10 minutes',
      verificationSid: result.sid
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

  // Verify OTP using Twilio Verify API
  console.log('🔍 [userVerifyOTP] Calling twilioVerifyService.verifyOTP...');
  const result = await twilioVerifyService.verifyOTP(phoneNumber, otp);
  console.log('🔍 [userVerifyOTP] OTP verification result:', result);

  if (!result.valid) {
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
  const { phoneNumber, password, firstName, lastName } = req.body;

  // Validate required fields
  if (!phoneNumber || !password || !firstName) {
    throw new ValidationError('Phone number, password, and first name are required');
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
    isActive: true,
    profile: {
      firstName,
      lastName: lastName || ''
    }
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
        role: user.role,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName
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

  // Send OTP using Twilio Verify API
  const result = await twilioVerifyService.sendOTP(phoneNumber, 'sms');

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully for password reset',
    data: {
      phoneNumber,
      expiresIn: '10 minutes',
      verificationSid: result.sid
    }
  });
});

// Reset password with OTP
exports.userResetPassword = asyncHandler(async (req, res) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!phoneNumber || !otp || !newPassword) {
    throw new ValidationError('All fields are required');
  }

  // Verify OTP using Twilio Verify API
  const result = await twilioVerifyService.verifyOTP(phoneNumber, otp);
  if (!result.valid) {
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
 * GUEST USER AUTHENTICATION
 * Anonymous browsing - no phone/OTP required
 */

// Create anonymous guest session (for browsing only)
exports.createGuestSession = asyncHandler(async (req, res) => {
  // Generate a unique identifier for this anonymous guest session
  const crypto = require('crypto');
  const sessionId = crypto.randomUUID();

  // Generate anonymous guest token (24 hours expiry - shorter since it's anonymous)
  const { generateGuestAccessToken } = require('../utils/helpers');
  const accessToken = generateGuestAccessToken(sessionId, 'anonymous');

  res.status(200).json({
    success: true,
    message: 'Guest session created successfully',
    data: {
      sessionId,
      accessToken,
      expiresIn: '24 hours',
      note: 'This is a browsing-only session. Sign up to create bookings.'
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
  const existingDriver = await User.findOne({ phoneNumber, role: 'driver' });
  if (existingDriver) {
    throw new ValidationError('Driver with this phone number already exists');
  }

  // Send OTP using Twilio Verify API
  const result = await twilioVerifyService.sendOTP(phoneNumber, 'sms');

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '10 minutes',
      verificationSid: result.sid
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

  // Verify OTP using Twilio Verify API
  const result = await twilioVerifyService.verifyOTP(phoneNumber, otp);
  if (!result.valid) {
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
  const { phoneNumber, password, firstName, lastName } = req.body;

  // Validate required fields
  if (!phoneNumber || !password || !firstName) {
    throw new ValidationError('Phone number, password, and first name are required');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ phoneNumber });
  if (existingUser) {
    throw new ValidationError('User with this phone number already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Handle optional profile picture upload
  let profileImageUrl = null;
  if (req.file) {
    try {
      const { uploadToS3 } = require('../config/s3');
      const path = require('path');

      // Generate temporary driver ID for S3 path (will be replaced with actual driver ID)
      const tempId = Date.now();
      const fileExtension = path.extname(req.file.originalname);
      const s3FileName = `drivers/temp_${tempId}/profile_picture_${tempId}${fileExtension}`;

      // Upload to S3
      profileImageUrl = await uploadToS3(req.file.buffer, s3FileName, req.file.mimetype);
      console.log('Profile picture uploaded during signup:', profileImageUrl);
    } catch (error) {
      console.error('Failed to upload profile picture during signup:', error);
      // Don't fail signup if profile picture upload fails
    }
  }

  // Create user with driver role
  const user = await User.create({
    phoneNumber,
    password: hashedPassword,
    role: 'driver',
    isVerified: true,
    isActive: true,
    profile: {
      firstName,
      lastName: lastName || '',
      profileImage: profileImageUrl
    }
  });

  // Create driver profile linked to user
  const driver = await Driver.create({
    userId: user._id,
    approvalStatus: 'pending'
  });

  // If profile picture was uploaded with temp ID, move it to proper location
  if (profileImageUrl && req.file) {
    try {
      const { uploadToS3, deleteFromS3, extractS3Key } = require('../config/s3');
      const path = require('path');

      const fileExtension = path.extname(req.file.originalname);
      const properS3FileName = `drivers/${driver._id}/profile_picture_${Date.now()}${fileExtension}`;

      // Upload to proper location
      const properS3Url = await uploadToS3(req.file.buffer, properS3FileName, req.file.mimetype);

      // Delete temp file
      const tempS3Key = extractS3Key(profileImageUrl);
      await deleteFromS3(tempS3Key);

      // Update user with proper URL
      user.profile.profileImage = properS3Url;
      await user.save();

      profileImageUrl = properS3Url;
      console.log('Profile picture moved to proper location:', properS3Url);
    } catch (error) {
      console.error('Failed to move profile picture to proper location:', error);
      // Continue with temp URL if move fails
    }
  }

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
        role: user.role,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        profileImage: profileImageUrl
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

  // Send OTP using Twilio Verify API
  const result = await twilioVerifyService.sendOTP(phoneNumber, 'sms');

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully for password reset',
    data: {
      phoneNumber,
      expiresIn: '10 minutes',
      verificationSid: result.sid
    }
  });
});

// Reset password with OTP
exports.driverResetPassword = asyncHandler(async (req, res) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!phoneNumber || !otp || !newPassword) {
    throw new ValidationError('All fields are required');
  }

  // Verify OTP using Twilio Verify API
  const result = await twilioVerifyService.verifyOTP(phoneNumber, otp);
  if (!result.valid) {
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
 * ADMIN AUTHENTICATION (OTP-based only)
 */

// Send OTP for admin login
exports.adminLogin = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }

  // Check if admin exists
  const admin = await User.findOne({ phoneNumber, role: 'admin' });
  if (!admin) {
    throw new AuthenticationError('Admin not found with this phone number');
  }

  // Check if account is active
  if (!admin.isActive) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Send OTP using Twilio Verify API
  const result = await twilioVerifyService.sendOTP(phoneNumber, 'sms');

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '10 minutes',
      verificationSid: result.sid
    }
  });
});

// Verify OTP and complete admin login
exports.adminVerifyOTP = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  // Validate required fields
  if (!phoneNumber || !otp) {
    throw new ValidationError('Phone number and OTP are required');
  }

  // Verify OTP using Twilio Verify API
  const result = await twilioVerifyService.verifyOTP(phoneNumber, otp);
  if (!result.valid) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Find admin
  const admin = await User.findOne({ phoneNumber, role: 'admin' });
  if (!admin) {
    throw new AuthenticationError('Admin not found');
  }

  // Check if account is active
  if (!admin.isActive) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Generate tokens
  const accessToken = generateAccessToken(admin._id, admin.role);
  const refreshToken = generateRefreshToken(admin._id, admin.role);

  // Clean expired tokens and add new refresh token
  admin.cleanExpiredTokens();
  admin.refreshTokens.push({ token: refreshToken });
  await admin.save();

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: admin._id,
        phoneNumber: admin.phoneNumber,
        role: admin.role,
        username: admin.username
      },
      accessToken,
      refreshToken
    }
  });
});

// Admin refresh access token
exports.adminRefreshToken = asyncHandler(async (req, res) => {
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

  // Find user (admin) and verify refresh token matches
  const user = await User.findById(decoded.userId);
  if (!user || user.role !== 'admin') {
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

/**
 * FORGOT PASSWORD
 */

// Request password reset (send OTP)
exports.forgotPasswordRequest = asyncHandler(async (req, res) => {
  let { phoneNumber, role } = req.body;

  if (!phoneNumber || !role) {
    throw new ValidationError('Phone number and role are required');
  }

  // Clean phone number - remove invisible Unicode characters and whitespace
  phoneNumber = cleanPhoneNumber(phoneNumber);
  console.log('🧹 Cleaned phone number:', phoneNumber);

  if (!['user', 'driver'].includes(role)) {
    throw new ValidationError('Role must be either "user" or "driver"');
  }

  // Check if user/driver exists
  let userExists;
  if (role === 'driver') {
    userExists = await User.findOne({ phoneNumber, role: 'driver' });
  } else {
    userExists = await User.findOne({ phoneNumber, role: 'user' });
  }

  if (!userExists) {
    throw new ValidationError('No account found with this phone number');
  }

  // Generate OTP
  const { otpCode } = await otpService.generateOTP(phoneNumber, OTP_PURPOSE.PASSWORD_RESET);

  // Send OTP via SMS
  await smsService.sendOTP(phoneNumber, otpCode, OTP_PURPOSE.PASSWORD_RESET);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your phone number',
    data: {
      phoneNumber,
      expiresIn: '5 minutes'
    }
  });
});

// Verify OTP for password reset
exports.forgotPasswordVerifyOTP = asyncHandler(async (req, res) => {
  let { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    throw new ValidationError('Phone number and OTP are required');
  }

  // Clean phone number
  phoneNumber = cleanPhoneNumber(phoneNumber);

  // Verify OTP
  await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.PASSWORD_RESET);

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      verified: true,
      phoneNumber
    }
  });
});

// Reset password
exports.forgotPasswordReset = asyncHandler(async (req, res) => {
  let { phoneNumber, otp, newPassword, role } = req.body;

  if (!phoneNumber || !otp || !newPassword || !role) {
    throw new ValidationError('Phone number, OTP, new password, and role are required');
  }

  // Clean phone number
  phoneNumber = cleanPhoneNumber(phoneNumber);

  if (!['user', 'driver'].includes(role)) {
    throw new ValidationError('Role must be either "user" or "driver"');
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new ValidationError('Password must be at least 8 characters with uppercase, lowercase, number and special character');
  }

  // Check if OTP was verified (either still unverified or already verified)
  const otpValid = await otpService.validateOTP(phoneNumber, otp, OTP_PURPOSE.PASSWORD_RESET);
  const otpVerified = await otpService.isOTPVerified(phoneNumber, otp, OTP_PURPOSE.PASSWORD_RESET);

  if (!otpValid && !otpVerified) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Find user/driver
  let user;
  if (role === 'driver') {
    user = await User.findOne({ phoneNumber, role: 'driver' });
  } else {
    user = await User.findOne({ phoneNumber, role: 'user' });
  }

  if (!user) {
    throw new ValidationError('User not found');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  user.password = hashedPassword;

  // Invalidate all existing refresh tokens (force re-login on all devices)
  user.refreshTokens = [];

  await user.save();

  // Delete the used OTP
  await otpService.deleteOTP(phoneNumber, OTP_PURPOSE.PASSWORD_RESET);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.',
    data: {
      phoneNumber,
      passwordUpdated: true
    }
  });
});
