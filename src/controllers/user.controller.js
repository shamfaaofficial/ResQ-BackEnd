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

module.exports = exports;
