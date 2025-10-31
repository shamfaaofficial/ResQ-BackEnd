const cron = require('node-cron');
const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../config/constants');
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
      booking.status = BOOKING_STATUS.CANCELLED_BY_DRIVER;
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

    // 2. Cancel bookings where payment not completed within 5 minutes of acceptance
    const expiredPayments = await Booking.find({
      status: BOOKING_STATUS.ACCEPTED,
      paymentExpiresAt: { $lte: now }
    });

    for (const booking of expiredPayments) {
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
    }

    if (expiredRequests.length > 0 || expiredPayments.length > 0) {
      console.log(`[Booking Job] Expired ${expiredRequests.length} requests, ${expiredPayments.length} payment timeouts`);
    }
  } catch (error) {
    console.error('[Booking Job] Error:', error);
  }
});

console.log('✓ Booking expiry job scheduled (runs every minute)');
