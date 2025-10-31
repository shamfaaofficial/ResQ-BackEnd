const mongoose = require('mongoose');
const { BOOKING_STATUS, VEHICLE_TYPES, PAYMENT_STATUS } = require('../config/constants');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.REQUESTED,
    index: true
  },
  vehicleType: {
    type: String,
    enum: Object.values(VEHICLE_TYPES),
    required: true
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
    paymentId: String,
    paymentMethod: String,
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    paidAt: Date,
    transactionId: String,
    invoiceId: String
  },
  timeline: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date,
    driverArrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date
  },
  requestExpiresAt: {
    type: Date,
    required: true,
    index: true
  },
  paymentExpiresAt: {
    type: Date,
    index: true
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
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ requestExpiresAt: 1 }, { expireAfterSeconds: 0 });
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
