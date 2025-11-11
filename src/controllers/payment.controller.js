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
  const isUser = booking.userId._id.toString() === req.userId;

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
        paidAt: booking.payment?.paidAt,
        failedAt: booking.payment?.failedAt
      },
      pricing: booking.pricing,
      timeline: booking.timeline
    }
  });
});

module.exports = exports;
