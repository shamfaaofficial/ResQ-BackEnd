const mongoose = require('mongoose');
const { BOOKING_STATUS, VEHICLE_TYPES, PAYMENT_STATUS } = require('../config/constants');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.REQUESTED
  },
  vehicleType: {
    type: String,
    enum: Object.values(VEHICLE_TYPES),
    required: false
  },
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      type: String,
      required: true
    },
    placeName: String
  },
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      type: String,
      required: true
    },
    placeName: String
  },
  actualDropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  distance: {
    estimated: {
      type: Number,
      required: true
    },
    actual: {
      type: Number,
      default: 0
    }
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    perKmRate: {
      type: Number,
      required: true
    },
    totalDistance: {
      type: Number,
      required: true
    },
    distancePrice: {
      type: Number,
      required: true
    },
    serviceFee: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'QAR'
    }
  },
  payment: {
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    method: String,
    gateway: {
      type: String,
      default: 'MyFatoorah'
    },
    invoiceId: String,
    transactionId: String,
    paidAmount: Number,
    paidAt: Date,
    initiatedAt: Date,
    failedAt: Date,
    gatewayResponse: mongoose.Schema.Types.Mixed,
    refundStatus: String,
    refundAmount: Number,
    refundDate: Date
  },
  timeline: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date,
    paymentCompletedAt: Date,
    driverArrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date
  },
  requestExpiresAt: {
    type: Date,
    required: true
  },
  paymentExpiresAt: {
    type: Date
  },
  cancellationDetails: {
    cancelledBy: {
      type: String,
      enum: ['user', 'driver', 'system', 'admin']
    },
    reason: String,
    cancelledAt: Date
  },
  driverEarnings: {
    type: Number,
    default: 0
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  searchRadius: {
    type: Number,
    default: 10
  },
  notes: {
    type: String,
    maxlength: 500
  },
  verificationCode: {
    code: {
      type: String,
      length: 4
    },
    generatedAt: Date,
    verifiedAt: Date,
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  arrivalVerification: {
    driverLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number] // [lng, lat]
    },
    distanceFromPickup: Number, // meters
    verifiedAt: Date,
    isVerified: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
// bookingNumber already has unique index from schema definition
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
// REMOVED TTL index - it was auto-deleting ALL bookings after 60 seconds, including active trips
// We use the cron job in booking.job.js instead for controlled expiry logic
// bookingSchema.index({ requestExpiresAt: 1 }, { expireAfterSeconds: 0 });
bookingSchema.index({ requestExpiresAt: 1 }); // Keep regular index for query performance
bookingSchema.index({ pickupLocation: '2dsphere' });

// Virtual for total trip time
bookingSchema.virtual('tripDuration').get(function() {
  if (this.timeline.completedAt && this.timeline.startedAt) {
    return Math.round((this.timeline.completedAt - this.timeline.startedAt) / 1000 / 60); // in minutes
  }
  return 0;
});

// Method to check if booking is expired
bookingSchema.methods.isExpired = function() {
  return this.requestExpiresAt && new Date() > this.requestExpiresAt;
};

// Method to check if payment is expired
bookingSchema.methods.isPaymentExpired = function() {
  return this.paymentExpiresAt && new Date() > this.paymentExpiresAt;
};

bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Booking', bookingSchema);
