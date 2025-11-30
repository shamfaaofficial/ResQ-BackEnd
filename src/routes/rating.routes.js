const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/rating.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * USER RATING ROUTES
 */

// Submit rating for driver (protected - user only)
router.post(
  '/driver/:bookingId',
  authMiddleware,
  roleMiddleware('user'),
  ratingController.rateDriver
);

/**
 * DRIVER RATING ROUTES
 */

// Submit rating for user (protected - driver only)
router.post(
  '/user/:bookingId',
  authMiddleware,
  roleMiddleware('driver'),
  ratingController.rateUser
);

/**
 * SHARED ROUTES
 */

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

// Get my ratings (protected)
router.get(
  '/my-ratings',
  authMiddleware,
  ratingController.getMyRatings
);

// Get driver's ratings and reviews (public or protected)
router.get(
  '/driver/:driverId',
  ratingController.getDriverRatings
);

module.exports = router;
