const Notification = require('../models/Notification');
const { NOTIFICATION_TYPE } = require('../config/constants');

class NotificationService {
  /**
   * Create notification for user
   */
  async createNotification({ userId, driverId, bookingId, type, title, message, data = {} }) {
    try {
      const notification = await Notification.create({
        userId,
        driverId,
        bookingId,
        type,
        title,
        message,
        data
      });

      // TODO: Send push notification here (FCM, OneSignal, etc.)
      console.log(`Notification created: ${type} - ${title}`);

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Notify user about booking request
   */
  async notifyBookingRequest(userId, bookingId, bookingNumber) {
    return this.createNotification({
      userId,
      bookingId,
      type: NOTIFICATION_TYPE.BOOKING_REQUEST,
      title: 'Booking Requested',
      message: `Your booking ${bookingNumber} has been requested. Waiting for driver acceptance.`,
      data: { bookingId, bookingNumber }
    });
  }

  /**
   * Notify driver about new booking
   */
  async notifyDriverNewBooking(driverId, bookingId, pickupAddress) {
    return this.createNotification({
      driverId,
      bookingId,
      type: NOTIFICATION_TYPE.BOOKING_REQUEST,
      title: 'New Booking Request',
      message: `New tow request at ${pickupAddress}. Accept within 1 minute.`,
      data: { bookingId, pickupAddress }
    });
  }

  /**
   * Notify user about booking acceptance
   */
  async notifyBookingAccepted(userId, bookingId, driverName) {
    return this.createNotification({
      userId,
      bookingId,
      type: NOTIFICATION_TYPE.BOOKING_ACCEPTED,
      title: 'Booking Accepted',
      message: `Driver ${driverName} has accepted your request. Payment required within 5 minutes.`,
      data: { bookingId, driverName }
    });
  }

  /**
   * Notify about booking cancellation
   */
  async notifyBookingCancelled(userId, driverId, bookingId, reason, cancelledBy) {
    const userMessage = cancelledBy === 'driver'
      ? `Your booking has been cancelled by the driver. Reason: ${reason}`
      : 'Your booking has been cancelled.';

    const driverMessage = cancelledBy === 'user'
      ? 'The booking has been cancelled by the customer.'
      : 'You have cancelled the booking.';

    if (userId) {
      await this.createNotification({
        userId,
        bookingId,
        type: NOTIFICATION_TYPE.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: userMessage,
        data: { bookingId, reason, cancelledBy }
      });
    }

    if (driverId) {
      await this.createNotification({
        driverId,
        bookingId,
        type: NOTIFICATION_TYPE.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: driverMessage,
        data: { bookingId, reason, cancelledBy }
      });
    }
  }

  /**
   * Notify user that driver has arrived
   */
  async notifyDriverArrived(userId, bookingId, driverName) {
    return this.createNotification({
      userId,
      bookingId,
      type: NOTIFICATION_TYPE.DRIVER_ARRIVED,
      title: 'Driver Arrived',
      message: `${driverName} has arrived at your location.`,
      data: { bookingId, driverName }
    });
  }

  /**
   * Notify trip started
   */
  async notifyTripStarted(userId, bookingId) {
    return this.createNotification({
      userId,
      bookingId,
      type: NOTIFICATION_TYPE.TRIP_STARTED,
      title: 'Trip Started',
      message: 'Your vehicle is now being towed to the destination.',
      data: { bookingId }
    });
  }

  /**
   * Notify trip completed
   */
  async notifyTripCompleted(userId, driverId, bookingId, amount) {
    if (userId) {
      await this.createNotification({
        userId,
        bookingId,
        type: NOTIFICATION_TYPE.TRIP_COMPLETED,
        title: 'Trip Completed',
        message: `Your trip has been completed. Total: QAR ${amount}`,
        data: { bookingId, amount }
      });
    }

    if (driverId) {
      await this.createNotification({
        driverId,
        bookingId,
        type: NOTIFICATION_TYPE.TRIP_COMPLETED,
        title: 'Trip Completed',
        message: `Trip completed successfully. Amount earned: QAR ${amount}`,
        data: { bookingId, amount }
      });
    }
  }

  /**
   * Notify payment reminder
   */
  async notifyPaymentReminder(userId, bookingId, amount) {
    return this.createNotification({
      userId,
      bookingId,
      type: NOTIFICATION_TYPE.PAYMENT_REMINDER,
      title: 'Payment Pending',
      message: `Please complete payment of QAR ${amount} within 5 minutes to confirm your booking.`,
      data: { bookingId, amount }
    });
  }

  /**
   * Send admin message
   */
  async sendAdminMessage(userId, driverId, title, message) {
    return this.createNotification({
      userId,
      driverId,
      type: NOTIFICATION_TYPE.ADMIN_MESSAGE,
      title,
      message,
      data: {}
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('bookingId', 'bookingNumber status');

    const total = await Notification.countDocuments({ userId });
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }

  /**
   * Get driver notifications
   */
  async getDriverNotifications(driverId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ driverId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('bookingId', 'bookingNumber status');

    const total = await Notification.countDocuments({ driverId });
    const unreadCount = await Notification.countDocuments({ driverId, isRead: false });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    return await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId, driverId) {
    const filter = userId ? { userId } : { driverId };
    return await Notification.updateMany(filter, { isRead: true });
  }
}

module.exports = new NotificationService();
