const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driver.controller');
const authController = require('../controllers/auth.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const { locationUpdateLimiter } = require('../middlewares/rateLimiter');

// All routes are protected and require driver role

// Get driver profile
router.get(
  '/profile',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.getDriverProfile
);

// Update FCM token (protected - driver only)
router.post(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('driver'),
  authController.updateFcmToken
);

// Remove FCM token (protected - driver only)
router.delete(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('driver'),
  authController.removeFcmToken
);

// Update location
router.patch(
  '/location',
  authMiddleware,
  roleMiddleware('driver'),
  locationUpdateLimiter,
  driverController.updateLocation
);

// Toggle online status
router.patch(
  '/status',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.toggleOnlineStatus
);

// Update vehicle details
router.patch(
  '/vehicle',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.updateVehicleDetails
);

// Get earnings
router.get(
  '/earnings',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.getEarnings
);

// Update bank details
router.patch(
  '/bank-details',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.updateBankDetails
);

module.exports = router;
