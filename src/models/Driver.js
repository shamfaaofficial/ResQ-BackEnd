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
      required: true
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    vehicleMake: {
      type: String,
      required: true,
      trim: true
    },
    vehicleModel: {
      type: String,
      required: true,
      trim: true
    },
    vehicleYear: {
      type: Number,
      required: true
    },
    vehicleColor: {
      type: String,
      required: true,
      trim: true
    },
    vehicleImages: [{
      type: String
    }]
  },
  documents: {
    drivingLicense: {
      url: String,
      status: {
        type: String,
        enum: Object.values(DOCUMENT_STATUS),
        default: DOCUMENT_STATUS.PENDING
      },
      rejectionReason: String
    },
    vehicleRegistration: {
      url: String,
      status: {
        type: String,
        enum: Object.values(DOCUMENT_STATUS),
        default: DOCUMENT_STATUS.PENDING
      },
      rejectionReason: String
    },
    insurance: {
      url: String,
      status: {
        type: String,
        enum: Object.values(DOCUMENT_STATUS),
        default: DOCUMENT_STATUS.PENDING
      },
      rejectionReason: String
    },
    nationalId: {
      url: String,
      status: {
        type: String,
        enum: Object.values(DOCUMENT_STATUS),
        default: DOCUMENT_STATUS.PENDING
      },
      rejectionReason: String
    }
  },
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
  }
}, {
  timestamps: true
});

// Create 2dsphere index for geospatial queries
driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ userId: 1 });
driverSchema.index({ approvalStatus: 1, isOnline: 1 });

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
