const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * USER PROFILE ROUTES
 */

// Get user profile (protected - user only)
router.get(
  '/profile',
  authMiddleware,
  roleMiddleware('user'),
  userController.getUserProfile
);

// Update user profile (protected - user only)
router.patch(
  '/profile',
  authMiddleware,
  roleMiddleware('user'),
  userController.updateUserProfile
);

// Get wallet balance (protected - user only)
router.get(
  '/wallet',
  authMiddleware,
  roleMiddleware('user'),
  userController.getWalletBalance
);

// Get wallet with user info - for display screen (protected - user only)
router.get(
  '/wallet/display',
  authMiddleware,
  roleMiddleware('user'),
  userController.getWalletWithUserInfo
);

// Update wallet balance (protected - user only)
router.patch(
  '/wallet',
  authMiddleware,
  roleMiddleware('user'),
  userController.updateWalletBalance
);

// Change password (protected - user only)
router.patch(
  '/change-password',
  authMiddleware,
  roleMiddleware('user'),
  userController.changePassword
);

// Delete account (protected - user only)
router.delete(
  '/account',
  authMiddleware,
  roleMiddleware('user'),
  userController.deleteAccount
);

/**
 * BOOKING ROUTES
 */

// Get nearby drivers (protected - user only)
router.get(
  '/nearby-drivers',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getNearbyDrivers
);

/**
 * NOTIFICATION ROUTES
 */

// Update FCM token (protected - user only)
router.post(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('user'),
  authController.updateFcmToken
);

// Remove FCM token (protected - user only)
router.delete(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('user'),
  authController.removeFcmToken
);

/**
 * UTILITY ROUTES
 */

// Placeholder route
router.get('/status', (req, res) => {
  res.json({ success: true, message: 'User routes ready for implementation' });
});

module.exports = router;
