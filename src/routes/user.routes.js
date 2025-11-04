const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const authController = require('../controllers/auth.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

// Get nearby drivers (protected - user only)
router.get(
  '/nearby-drivers',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getNearbyDrivers
);

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

// Placeholder route
router.get('/status', (req, res) => {
  res.json({ success: true, message: 'User routes ready for implementation' });
});

// TODO: Implement all user routes as per IMPLEMENTATION_GUIDE.md

module.exports = router;
