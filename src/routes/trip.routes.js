const express = require('express');
const router = express.Router();
const tripController = require('../controllers/trip.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * USER TRIP ROUTES
 */

// Get trip details with verification code and driver info (protected - user only)
router.get(
  '/:bookingId/details',
  authMiddleware,
  roleMiddleware('user'),
  tripController.getTripDetails
);

/**
 * DRIVER TRIP ROUTES
 */

// Get trip details for driver (protected - driver only)
router.get(
  '/:bookingId/driver-details',
  authMiddleware,
  roleMiddleware('driver'),
  tripController.getDriverTripDetails
);

// Mark driver arrived at pickup location (protected - driver only)
router.post(
  '/:bookingId/mark-arrived',
  authMiddleware,
  roleMiddleware('driver'),
  tripController.markDriverArrived
);

// Verify pickup code before starting trip (protected - driver only)
router.post(
  '/:bookingId/verify-code',
  authMiddleware,
  roleMiddleware('driver'),
  tripController.verifyPickupCode
);

module.exports = router;
