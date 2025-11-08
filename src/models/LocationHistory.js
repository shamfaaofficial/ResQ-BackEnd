const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  speed: {
    type: Number, // Speed in km/h
    default: 0
  },
  heading: {
    type: Number, // Heading/bearing in degrees (0-360)
    default: 0
  },
  accuracy: {
    type: Number, // GPS accuracy in meters
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Create geospatial index
locationHistorySchema.index({ location: '2dsphere' });

// Create compound index for efficient queries
locationHistorySchema.index({ bookingId: 1, timestamp: -1 });
locationHistorySchema.index({ driverId: 1, timestamp: -1 });

// TTL index - auto-delete records after 30 days
locationHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Static method to get trip path
locationHistorySchema.statics.getTripPath = async function(bookingId) {
  return this.find({ bookingId })
    .sort({ timestamp: 1 })
    .select('location timestamp speed heading')
    .lean();
};

// Static method to get latest location for booking
locationHistorySchema.statics.getLatestLocation = async function(bookingId) {
  return this.findOne({ bookingId })
    .sort({ timestamp: -1 })
    .select('location timestamp')
    .lean();
};

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
