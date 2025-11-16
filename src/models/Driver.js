const mongoose = require('mongoose');
const { VEHICLE_TYPES, DOCUMENT_STATUS, APPROVAL_STATUS } = require('../config/constants');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  vehicleDetails: {
    vehicleType: {
      type: String,
      enum: Object.values(VEHICLE_TYPES),
      required: false
    },
    vehicleNumber: {
      type: String,
      required: false,
      trim: true,
      uppercase: true
    },
    vehicleMake: {
      type: String,
      required: false,
      trim: true
    },
    vehicleModel: {
      type: String,
      required: false,
      trim: true
    },
    vehicleYear: {
      type: Number,
      required: false
    },
    vehicleColor: {
      type: String,
      required: false,
      trim: true
    },
    vehicleImages: [{
      type: String
    }]
  },
  documents: [{
    type: {
      type: String,
      enum: ['license', 'registration', 'insurance', 'vehicle_photo', 'profile_photo', 'national_id', 'other']
    },
    url: {
      type: String
    },
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verifiedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    adminComments: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    fileName: {
      type: String
    },
    fileSize: {
      type: Number
    },
    mimeType: {
      type: String
    }
  }],
  approvalStatus: {
    type: String,
    enum: Object.values(APPROVAL_STATUS),
    default: APPROVAL_STATUS.PENDING
  },
  approvalDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  adminComments: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: {
      type: String
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  earnings: {
    totalEarnings: {
      type: Number,
      default: 0
    },
    availableBalance: {
      type: Number,
      default: 0
    },
    pendingBalance: {
      type: Number,
      default: 0
    }
  },
  bankDetails: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    iban: String
  },
  isLocationEnabled: {
    type: Boolean,
    default: false
  },
  fcmToken: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Create 2dsphere index for geospatial queries
driverSchema.index({ currentLocation: '2dsphere' });
// userId already has unique index from schema definition
driverSchema.index({ approvalStatus: 1, isOnline: 1 });
// Compound index for nearby driver queries (online + location)
driverSchema.index({ isOnline: 1, currentLocation: '2dsphere' });

// Method to update location
driverSchema.methods.updateLocation = function(longitude, latitude, address) {
  this.currentLocation.coordinates = [longitude, latitude];
  this.currentLocation.address = address;
  this.currentLocation.lastUpdated = new Date();
  this.isLocationEnabled = true;
};

// Method to check if driver can accept bookings
driverSchema.methods.canAcceptBookings = function() {
  return this.approvalStatus === APPROVAL_STATUS.APPROVED &&
         this.isOnline &&
         this.isLocationEnabled;
};

module.exports = mongoose.model('Driver', driverSchema);
