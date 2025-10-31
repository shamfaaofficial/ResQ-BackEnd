module.exports = {
  ROLES: {
    USER: 'user',
    DRIVER: 'driver',
    ADMIN: 'admin'
  },

  VEHICLE_TYPES: {
    SMALL_CAR: 'small_car',
    SEDAN: 'sedan',
    SUV: 'suv',
    TRUCK: 'truck',
    HEAVY_VEHICLE: 'heavy_vehicle'
  },

  BOOKING_STATUS: {
    REQUESTED: 'requested',
    ACCEPTED: 'accepted',
    DRIVER_ARRIVED: 'driver_arrived',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED_BY_USER: 'cancelled_by_user',
    CANCELLED_BY_DRIVER: 'cancelled_by_driver',
    PAYMENT_PENDING: 'payment_pending',
    PAYMENT_COMPLETED: 'payment_completed'
  },

  DOCUMENT_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  APPROVAL_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  OTP_PURPOSE: {
    SIGNUP: 'signup',
    LOGIN: 'login',
    PASSWORD_RESET: 'password_reset'
  },

  TRANSACTION_TYPE: {
    BOOKING_PAYMENT: 'booking_payment',
    DRIVER_EARNING: 'driver_earning',
    WITHDRAWAL: 'withdrawal',
    REFUND: 'refund',
    COMMISSION: 'commission'
  },

  WITHDRAWAL_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSED: 'processed'
  },

  NOTIFICATION_TYPE: {
    BOOKING_REQUEST: 'booking_request',
    BOOKING_ACCEPTED: 'booking_accepted',
    BOOKING_CANCELLED: 'booking_cancelled',
    DRIVER_ARRIVED: 'driver_arrived',
    TRIP_STARTED: 'trip_started',
    TRIP_COMPLETED: 'trip_completed',
    PAYMENT_REMINDER: 'payment_reminder',
    ADMIN_MESSAGE: 'admin_message'
  },

  QATAR_COUNTRY_CODE: '+974',

  OTP_EXPIRY_MINUTES: 5,
  OTP_MAX_ATTEMPTS: 3,
  BOOKING_REQUEST_TIMEOUT_SECONDS: 60,
  PAYMENT_TIMEOUT_SECONDS: 300,

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  }
};
