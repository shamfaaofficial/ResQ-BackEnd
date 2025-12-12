const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

/**
 * PAYMENT INITIATION (User starts payment process)
 */

// Initiate payment with bookingId in body (protected - user only)
router.post(
  '/initiate',
  authMiddleware,
  roleMiddleware('user'),
  paymentController.initiatePaymentFromBody
);

// Initiate payment with bookingId in URL (protected - user only)
router.post(
  '/initiate/:bookingId',
  authMiddleware,
  roleMiddleware('user'),
  paymentController.initiatePayment
);

/**
 * MYFATOORAH CALLBACK & WEBHOOK ROUTES (Public - MyFatoorah calls these)
 */

// Payment success callback - MyFatoorah redirects here after successful payment
router.get(
  '/callback',
  paymentController.handlePaymentCallback
);

// Payment error callback - MyFatoorah redirects here on error
router.get(
  '/error',
  paymentController.handlePaymentError
);

// Payment webhook - MyFatoorah sends POST notification here
router.post(
  '/webhook',
  paymentController.handlePaymentWebhook
);

/**
 * USER PAYMENT ROUTE (Alternative - Flutter direct update)
 * Flutter app can call this after completing payment with MyFatoorah
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
