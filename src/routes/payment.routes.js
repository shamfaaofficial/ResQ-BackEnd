const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * USER PAYMENT ROUTE
 * Flutter app will call this after completing payment with MyFatoorah
 */

// Update payment status from Flutter (protected - user only)
router.post(
  '/update/:bookingId',
  authMiddleware,
  roleMiddleware('user'),
  paymentController.updatePaymentStatus
);

/**
 * DRIVER PAYMENT ROUTE
 * Driver polls this endpoint to check if user has paid
 */

// Check payment status for booking (protected - driver only)
router.get(
  '/check/:bookingId',
  authMiddleware,
  roleMiddleware('driver'),
  paymentController.checkPaymentStatus
);

/**
 * SHARED ROUTE
 * Get full payment details for a booking
 */

// Get payment details (protected - user or driver)
router.get(
  '/details/:bookingId',
  authMiddleware,
  paymentController.getPaymentDetails
);

module.exports = router;
