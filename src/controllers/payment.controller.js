const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const Transaction = require('../models/Transaction');
const notificationService = require('../services/notification.service');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { BOOKING_STATUS, PAYMENT_STATUS, TRANSACTION_TYPE } = require('../config/constants');
const { emitBookingUpdate } = require('../config/socket');

/**
 * USER PAYMENT API - Store payment details from Flutter
 */
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const {
    paymentStatus,      // 'paid', 'failed', 'cancelled', 'pending'
    invoiceId,
    transactionId,
    paymentMethod,
    paidAmount,
    paymentReference,
    gatewayResponse     // Full MyFatoorah response object from Flutter
  } = req.body;

  // Find booking and verify it belongs to the user
  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Validate booking status
  if (booking.status !== BOOKING_STATUS.ACCEPTED) {
    throw new ValidationError('Payment can only be updated for accepted bookings');
  }

  // Map payment status to our constants
  let mappedStatus;
  switch (paymentStatus?.toLowerCase()) {
    case 'paid':
    case 'success':
    case 'completed':
      mappedStatus = PAYMENT_STATUS.COMPLETED;
      break;
    case 'failed':
    case 'cancelled':
    case 'canceled':
      mappedStatus = PAYMENT_STATUS.FAILED;
      break;
    case 'pending':
      mappedStatus = PAYMENT_STATUS.PENDING;
      break;
    default:
      mappedStatus = PAYMENT_STATUS.PENDING;
  }

  // Update booking payment details
  booking.payment = {
    status: mappedStatus,
    method: paymentMethod || 'MyFatoorah',
    gateway: 'MyFatoorah',
    invoiceId: invoiceId,
    transactionId: transactionId || paymentReference,
    paidAmount: paidAmount || booking.pricing.totalAmount,
    paidAt: mappedStatus === PAYMENT_STATUS.COMPLETED ? new Date() : null,
    failedAt: mappedStatus === PAYMENT_STATUS.FAILED ? new Date() : null,
    gatewayResponse: gatewayResponse || {}
  };

  // If payment is completed, update booking status
  if (mappedStatus === PAYMENT_STATUS.COMPLETED) {
    booking.status = BOOKING_STATUS.PAYMENT_COMPLETED;
    booking.timeline.paymentCompletedAt = new Date();
    // IMPORTANT: Clear payment expiry since payment is now completed
    booking.paymentExpiresAt = null;

    // Create transaction record
    await Transaction.create({
      transactionId: transactionId || `TXN-${Date.now()}`,
      bookingId: booking._id,
      userId: booking.userId,
      driverId: booking.driverId,
      type: TRANSACTION_TYPE.BOOKING_PAYMENT,
      amount: paidAmount || booking.pricing.totalAmount,
      status: 'completed',
      paymentMethod: paymentMethod,
      gateway: 'MyFatoorah',
      gatewayTransactionId: transactionId,
      description: `Payment for booking ${booking.bookingNumber}`
    });

    // Notify driver that payment is completed
    if (booking.driverId) {
      const driver = await Driver.findById(booking.driverId).populate('userId', 'fcmToken');
      if (driver && driver.userId?.fcmToken) {
        await notificationService.sendNotification(
          driver.userId._id,
          'Payment Received',
          `Payment of ${booking.pricing.totalAmount} ${booking.pricing.currency} received for booking ${booking.bookingNumber}. You can now proceed to pickup location.`,
          'payment_completed',
          { bookingId: booking._id }
        );
      }
    }

    // Emit Socket.IO event for real-time update
    try {
      emitBookingUpdate(booking);
    } catch (error) {
      console.error('[PaymentUpdate] Failed to emit socket event:', error.message);
    }
  }

  await booking.save();

  res.status(200).json({
    success: true,
    message: 'Payment status updated successfully',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.status,
      payment: {
        status: booking.payment.status,
        transactionId: booking.payment.transactionId,
        paidAmount: booking.payment.paidAmount,
        paidAt: booking.payment.paidAt
      }
    }
  });
});

/**
 * DRIVER API - Check if payment is completed (Polling)
 */
exports.checkPaymentStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Verify driver owns this booking
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId: driver._id
  }).select('bookingNumber status payment pricing timeline paymentExpiresAt');

  if (!booking) {
    throw new NotFoundError('Booking not found or not assigned to you');
  }

  // Check if payment is completed
  const isPaid = booking.payment?.status === PAYMENT_STATUS.COMPLETED;
  const isFailed = booking.payment?.status === PAYMENT_STATUS.FAILED;
  const isCancelled = booking.payment?.status === PAYMENT_STATUS.CANCELLED;
  const isExpired = booking.paymentExpiresAt && new Date() > booking.paymentExpiresAt;

  res.status(200).json({
    success: true,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.status,
      payment: {
        status: booking.payment?.status || PAYMENT_STATUS.PENDING,
        isPaid: isPaid,
        isFailed: isFailed,
        isCancelled: isCancelled,
        isExpired: isExpired,
        amount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        initiatedAt: booking.payment?.initiatedAt,
        paidAt: booking.payment?.paidAt,
        transactionId: booking.payment?.transactionId,
        expiresAt: booking.paymentExpiresAt,
        timeRemaining: booking.paymentExpiresAt
          ? Math.max(0, Math.floor((booking.paymentExpiresAt - new Date()) / 1000))
          : null
      },
      canProceed: isPaid && booking.status === BOOKING_STATUS.PAYMENT_COMPLETED
    }
  });
});

/**
 * Get payment details for a booking (User or Driver)
 */
exports.getPaymentDetails = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId)
    .populate('userId', 'phoneNumber profile')
    .select('bookingNumber status payment pricing timeline');

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Check authorization - user or driver only
  const driver = await Driver.findOne({ userId: req.userId });
  const isDriver = driver && booking.driverId && booking.driverId.toString() === driver._id.toString();

  // Handle both populated and non-populated userId - ALWAYS convert to string for comparison
  const bookingUserId = booking.userId._id ? booking.userId._id.toString() : booking.userId.toString();
  const requestUserId = req.userId.toString(); // Convert ObjectId to string
  const isUser = bookingUserId === requestUserId;

  console.log('[GetPaymentDetails] Authorization check:');
  console.log('  - req.userId:', req.userId);
  console.log('  - booking.userId:', bookingUserId);
  console.log('  - isUser:', isUser);
  console.log('  - isDriver:', isDriver);

  if (!isDriver && !isUser) {
    throw new ValidationError('You are not authorized to view this payment');
  }

  res.status(200).json({
    success: true,
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: {
        status: booking.payment?.status || PAYMENT_STATUS.PENDING,
        method: booking.payment?.method,
        transactionId: booking.payment?.transactionId,
        invoiceId: booking.payment?.invoiceId,
        amount: booking.payment?.paidAmount || booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        initiatedAt: booking.payment?.initiatedAt,
        paidAt: booking.payment?.paidAt,
        failedAt: booking.payment?.failedAt
      },
      pricing: booking.pricing,
      timeline: booking.timeline
    }
  });
});

/**
 * INITIATE PAYMENT - Generate MyFatoorah payment URL
 * User calls this to get payment link after driver accepts
 */
exports.initiatePayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const paymentService = require('../services/payment.service');
  const User = require('../models/User');

  console.log(`[InitiatePayment] User ${req.userId} initiating payment for booking ${bookingId}`);

  // Find booking and verify it belongs to the user
  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.userId
  }).populate('driverId', 'vehicleDetails');

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Validate booking status - must be accepted
  if (booking.status !== BOOKING_STATUS.ACCEPTED) {
    throw new ValidationError(`Cannot initiate payment. Booking status is ${booking.status}. Must be 'accepted'.`);
  }

  // Check if payment already completed
  if (booking.payment?.status === PAYMENT_STATUS.COMPLETED) {
    return res.status(200).json({
      success: true,
      message: 'Payment already completed',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        payment: booking.payment
      }
    });
  }

  // Get user details
  const user = await User.findById(req.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  try {
    // Call MyFatoorah to generate payment URL
    const paymentResponse = await paymentService.initiatePayment(booking, user);

    if (!paymentResponse.success) {
      throw new Error(paymentResponse.message || 'Payment initiation failed');
    }

    // Update booking with payment details
    booking.payment = {
      ...booking.payment,
      status: PAYMENT_STATUS.PENDING,
      gateway: 'MyFatoorah',
      invoiceId: paymentResponse.invoiceId,
      paymentUrl: paymentResponse.paymentUrl,
      initiatedAt: new Date()
    };
    await booking.save();

    console.log(`[InitiatePayment] ✅ Payment URL generated for booking ${booking.bookingNumber}`);
    console.log(`[InitiatePayment] Payment URL: ${paymentResponse.paymentUrl}`);

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        paymentUrl: paymentResponse.paymentUrl,
        invoiceId: paymentResponse.invoiceId,
        amount: booking.pricing.totalAmount,
        currency: booking.pricing.currency || 'QAR',
        initiatedAt: booking.payment.initiatedAt,
        expiresAt: booking.paymentExpiresAt
      }
    });
  } catch (error) {
    console.error(`[InitiatePayment] ❌ Error:`, error.message);
    throw new Error(`Payment initiation failed: ${error.message}`);
  }
});

/**
 * PAYMENT CALLBACK - MyFatoorah redirects here after payment
 * This handles the return URL after user completes payment
 */
exports.handlePaymentCallback = asyncHandler(async (req, res) => {
  const { paymentId, Id } = req.query; // MyFatoorah sends 'paymentId' or 'Id'
  const paymentService = require('../services/payment.service');

  console.log(`[PaymentCallback] Received callback with paymentId: ${paymentId || Id}`);
  console.log(`[PaymentCallback] Query params:`, req.query);

  const actualPaymentId = paymentId || Id;

  if (!actualPaymentId) {
    console.error('[PaymentCallback] ❌ No payment ID provided');
    return res.redirect(`${process.env.FRONTEND_URL || 'https://resq-app.com'}/payment/error?reason=missing_payment_id`);
  }

  try {
    // Process payment callback using payment service
    const result = await paymentService.processPaymentCallback(actualPaymentId);

    if (result.success) {
      console.log(`[PaymentCallback] ✅ Payment successful for booking ${result.booking.bookingNumber}`);

      // Redirect to success page with booking details
      return res.redirect(
        `${process.env.FRONTEND_URL || 'https://resq-app.com'}/payment/success?bookingId=${result.booking._id}&bookingNumber=${result.booking.bookingNumber}`
      );
    } else {
      console.error(`[PaymentCallback] ❌ Payment failed:`, result.message);

      // Redirect to error page
      return res.redirect(
        `${process.env.FRONTEND_URL || 'https://resq-app.com'}/payment/error?reason=${encodeURIComponent(result.message)}`
      );
    }
  } catch (error) {
    console.error(`[PaymentCallback] ❌ Error processing callback:`, error.message);

    return res.redirect(
      `${process.env.FRONTEND_URL || 'https://resq-app.com'}/payment/error?reason=${encodeURIComponent(error.message)}`
    );
  }
});

/**
 * PAYMENT WEBHOOK - MyFatoorah sends POST request here
 * This is for server-to-server notification
 */
exports.handlePaymentWebhook = asyncHandler(async (req, res) => {
  const paymentService = require('../services/payment.service');

  console.log(`[PaymentWebhook] Received webhook from MyFatoorah`);
  console.log(`[PaymentWebhook] Body:`, JSON.stringify(req.body, null, 2));

  const { Data } = req.body;

  if (!Data || !Data.InvoiceId) {
    console.error('[PaymentWebhook] ❌ Invalid webhook data');
    return res.status(400).json({ success: false, message: 'Invalid webhook data' });
  }

  try {
    // Get payment status from MyFatoorah using InvoiceId
    const paymentStatus = await paymentService.getPaymentStatus(Data.InvoiceId);

    if (paymentStatus.success && paymentStatus.isPaid) {
      // Find booking by customer reference (booking ID)
      const booking = await Booking.findById(paymentStatus.customerReference);

      if (!booking) {
        console.error(`[PaymentWebhook] ❌ Booking not found: ${paymentStatus.customerReference}`);
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Update booking if not already updated
      if (booking.payment?.status !== PAYMENT_STATUS.COMPLETED) {
        booking.payment = {
          status: PAYMENT_STATUS.COMPLETED,
          method: paymentStatus.paymentMethod,
          transactionId: paymentStatus.transactionId,
          paidAmount: paymentStatus.paidAmount,
          paidAt: new Date(paymentStatus.paymentDate),
          gateway: 'MyFatoorah',
          gatewayResponse: paymentStatus
        };
        booking.status = BOOKING_STATUS.PAYMENT_COMPLETED;
        booking.timeline.paymentCompletedAt = new Date();
        booking.paymentExpiresAt = null;

        // Generate 4-digit verification code for pickup
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        booking.verificationCode = {
          code: verificationCode,
          generatedAt: new Date(),
          isVerified: false
        };

        console.log(`[PaymentWebhook] 🔐 Generated verification code: ${verificationCode} for booking ${booking.bookingNumber}`);

        await booking.save();

        // Create transaction record
        await Transaction.create({
          transactionId: paymentStatus.transactionId,
          bookingId: booking._id,
          userId: booking.userId,
          driverId: booking.driverId,
          type: TRANSACTION_TYPE.BOOKING_PAYMENT,
          amount: paymentStatus.paidAmount,
          status: 'completed',
          paymentMethod: paymentStatus.paymentMethod,
          gateway: 'MyFatoorah',
          gatewayTransactionId: paymentStatus.transactionId,
          description: `Payment for booking ${booking.bookingNumber}`
        });

        console.log(`[PaymentWebhook] ✅ Payment webhook processed for booking ${booking.bookingNumber}`);

        // Notify driver
        if (booking.driverId) {
          await notificationService.sendNotification(
            booking.driverId,
            'Payment Received',
            `Payment completed for booking ${booking.bookingNumber}`,
            'payment_completed',
            { bookingId: booking._id }
          );
        }
      }

      return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } else {
      console.error(`[PaymentWebhook] ❌ Payment not successful:`, paymentStatus);
      return res.status(200).json({ success: true, message: 'Payment not completed' });
    }
  } catch (error) {
    console.error(`[PaymentWebhook] ❌ Error processing webhook:`, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PAYMENT ERROR HANDLER - MyFatoorah redirects here on error
 */
exports.handlePaymentError = asyncHandler(async (req, res) => {
  const { paymentId, Id } = req.query;
  const paymentService = require('../services/payment.service');

  console.log(`[PaymentError] Payment error callback received`);
  console.log(`[PaymentError] Query params:`, req.query);

  const actualPaymentId = paymentId || Id;

  try {
    // Get payment status from MyFatoorah to understand what went wrong
    if (actualPaymentId) {
      const paymentStatus = await paymentService.getPaymentStatus(actualPaymentId);
      console.log(`[PaymentError] Payment status from MyFatoorah:`, JSON.stringify(paymentStatus, null, 2));

      // Try to find and update the booking
      if (paymentStatus.CustomerReference) {
        const booking = await Booking.findById(paymentStatus.CustomerReference);
        if (booking) {
          booking.payment = {
            ...booking.payment,
            status: PAYMENT_STATUS.FAILED,
            failedAt: new Date(),
            gatewayResponse: paymentStatus
          };
          await booking.save();
          console.log(`[PaymentError] ❌ Booking ${booking.bookingNumber} payment marked as failed`);
        }
      }
    }
  } catch (error) {
    console.error(`[PaymentError] Error fetching payment status:`, error.message);
  }

  // Redirect to frontend error page
  return res.redirect(
    `${process.env.FRONTEND_URL || 'https://resq-app.com'}/payment/error?reason=payment_failed`
  );
});

module.exports = exports;
