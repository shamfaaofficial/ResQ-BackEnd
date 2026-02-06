const cron = require('node-cron');
const Booking = require('../models/Booking');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../config/constants');
const notificationService = require('../services/notification.service');

// Run every minute to check for expired bookings
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // 1. Expire booking requests that haven't been accepted within 1 minute
    const expiredRequests = await Booking.find({
      status: BOOKING_STATUS.REQUESTED,
      requestExpiresAt: { $lte: now }
    });

    for (const booking of expiredRequests) {
      // Set payment status to FAILED since no driver accepted
      if (booking.payment.status === PAYMENT_STATUS.PENDING) {
        booking.payment.status = PAYMENT_STATUS.FAILED;
        booking.payment.failedAt = now;
      }

      booking.status = BOOKING_STATUS.EXPIRED;
      booking.cancellationDetails = {
        cancelledBy: 'system',
        reason: 'No driver accepted within 1 minute',
        cancelledAt: now
      };
      booking.timeline.cancelledAt = now;
      await booking.save();

      // Notify user
      await notificationService.notifyBookingCancelled(
        booking.userId,
        null,
        booking._id,
        'No driver available at this time',
        'system'
      );
    }

    // 2. DISABLED: Payment timeout logic - Not applicable for cash payments
    // Cash flow: Driver accepts → Goes to pickup → Collects cash at the end
    // Keeping code for reference if online payments are re-enabled in the future
    /*
    const expiredPayments = await Booking.find({
      status: BOOKING_STATUS.ACCEPTED,
      paymentExpiresAt: { $lte: now }
    });

    for (const booking of expiredPayments) {
      // Set payment status to FAILED since payment timed out
      if (booking.payment.status === PAYMENT_STATUS.PENDING) {
        booking.payment.status = PAYMENT_STATUS.FAILED;
        booking.payment.failedAt = now;
      }

      booking.status = BOOKING_STATUS.CANCELLED_BY_USER;
      booking.cancellationDetails = {
        cancelledBy: 'system',
        reason: 'Payment not completed within 5 minutes',
        cancelledAt: now
      };
      booking.timeline.cancelledAt = now;
      await booking.save();

      // Notify both user and driver
      await notificationService.notifyBookingCancelled(
        booking.userId,
        booking.driverId,
        booking._id,
        'Payment timeout - booking cancelled',
        'system'
      );

      // Mark driver as not busy if assigned
      if (booking.driverId) {
        const driver = await require('../models/Driver').findById(booking.driverId);
        if (driver) {
          driver.isBusy = false;
          await driver.save();
        }
      }
    }
    */
    const expiredPayments = []; // Empty array since payment timeout is disabled for cash flow

    if (expiredRequests.length > 0 || expiredPayments.length > 0) {
      console.log(`[Booking Job] Expired ${expiredRequests.length} requests, ${expiredPayments.length} payment timeouts`);
    }
  } catch (error) {
    console.error('[Booking Job] Error:', error);
  }
});

console.log('✓ Booking expiry job scheduled (runs every minute)');
