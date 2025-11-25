const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * USER BOOKING ROUTES
 */

// Get nearby drivers (protected - user only)
router.get(
  '/nearby-drivers',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getNearbyDrivers
);

// Get price estimate (protected - user only)
router.get(
  '/price-estimate',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getPriceEstimate
);

// Create booking (protected - user only)
router.post(
  '/',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.createBooking
);

// Get user's active booking (protected - user only)
router.get(
  '/user/active',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getUserActiveBooking
);

// Get booking status by ID including payment info (protected - user only)
router.get(
  '/user/:bookingId/status',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getBookingStatus
);

// Get live booking status with driver location and ETA (protected - user only)
router.get(
  '/user/:bookingId/live-status',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getBookingLiveStatus
);

// Get calculated price for booking after driver arrives (protected - user only)
router.get(
  '/user/:bookingId/price',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getBookingPrice
);

// Cancel booking (protected - user only)
router.patch(
  '/user/:bookingId/cancel',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.cancelBooking
);

// Get user's booking history (protected - user only)
router.get(
  '/user/history',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.getUserBookingHistory
);

// Request specific driver (protected - user only)
router.post(
  '/request-driver',
  authMiddleware,
  roleMiddleware('user'),
  bookingController.requestSpecificDriver
);

/**
 * DRIVER BOOKING ROUTES
 */

// Get available bookings for driver (protected - driver only)
router.get(
  '/driver/available',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.getAvailableBookings
);

// Get specific booking details by ID (protected - driver only)
router.get(
  '/driver/:bookingId/details',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.getBookingDetailsById
);

// Accept booking (protected - driver only)
router.patch(
  '/driver/:bookingId/accept',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.acceptBooking
);

// Get driver's active booking (protected - driver only)
router.get(
  '/driver/active',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.getDriverActiveBooking
);

// Mark driver arrived (protected - driver only)
router.patch(
  '/driver/:bookingId/arrived',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.markDriverArrived
);

// Verify pickup code (protected - driver only)
router.post(
  '/driver/:bookingId/verify-pickup',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.verifyPickupCode
);

// Start trip (protected - driver only)
router.patch(
  '/driver/:bookingId/start',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.startTrip
);

// Complete trip (protected - driver only)
router.patch(
  '/driver/:bookingId/complete',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.completeTrip
);

// Cancel booking by driver (protected - driver only)
router.patch(
  '/driver/:bookingId/cancel',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.cancelBookingByDriver
);

// Get driver's booking history (protected - driver only)
router.get(
  '/driver/history',
  authMiddleware,
  roleMiddleware('driver'),
  bookingController.getDriverBookingHistory
);

module.exports = router;
