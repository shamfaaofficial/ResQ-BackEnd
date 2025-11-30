const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/rating.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * SHARED/PUBLIC ROUTES
 */

// Get driver's ratings and reviews (public)
router.get(
  '/driver/:driverId',
  ratingController.getDriverRatings
);

// Check if user can rate a booking (protected)
router.get(
  '/can-rate/:bookingId',
  authMiddleware,
  ratingController.canRate
);

// Get rating for a specific booking (protected)
router.get(
  '/booking/:bookingId',
  authMiddleware,
  ratingController.getBookingRating
);

module.exports = router;
