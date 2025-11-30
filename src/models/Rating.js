const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true // One rating per booking
  },

  // Who is being rated
  ratedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },

  // Who gave the rating
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  ratedByRole: {
    type: String,
    enum: ['user', 'driver'],
    required: true
  },

  // User rating for Driver (when user rates driver)
  driverRating: {
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    serviceQuality: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    vehicleHandling: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    overall: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.ratedByRole === 'user';
      }
    },
    feedback: {
      type: String,
      maxlength: 500,
      default: ''
    },
    tags: [{
      type: String,
      enum: [
        'professional',
        'friendly',
        'careful',
        'fast',
        'helpful',
        'experienced',
        'rude',
        'careless',
        'slow',
        'damaged_vehicle'
      ]
    }]
  },

  // Driver rating for User (when driver rates user)
  userRating: {
    cooperation: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    locationAccuracy: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    communication: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    overall: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.ratedByRole === 'driver';
      }
    },
    feedback: {
      type: String,
      maxlength: 500,
      default: ''
    },
    tags: [{
      type: String,
      enum: [
        'polite',
        'patient',
        'cooperative',
        'clear_location',
        'ready_on_time',
        'rude',
        'uncooperative',
        'wrong_location',
        'late'
      ]
    }]
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
ratingSchema.index({ bookingId: 1 });
ratingSchema.index({ ratedDriver: 1 });
ratingSchema.index({ ratedUser: 1 });
ratingSchema.index({ ratedByRole: 1 });
ratingSchema.index({ 'driverRating.overall': -1 });
ratingSchema.index({ createdAt: -1 });

// Calculate average rating
ratingSchema.methods.getAverageDriverRating = function() {
  if (this.ratedByRole !== 'user' || !this.driverRating) {
    return null;
  }

  const ratings = [
    this.driverRating.professionalism,
    this.driverRating.serviceQuality,
    this.driverRating.timeliness,
    this.driverRating.vehicleHandling
  ].filter(r => r !== null);

  if (ratings.length === 0) return this.driverRating.overall;

  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return (sum / ratings.length).toFixed(2);
};

ratingSchema.methods.getAverageUserRating = function() {
  if (this.ratedByRole !== 'driver' || !this.userRating) {
    return null;
  }

  const ratings = [
    this.userRating.cooperation,
    this.userRating.locationAccuracy,
    this.userRating.communication
  ].filter(r => r !== null);

  if (ratings.length === 0) return this.userRating.overall;

  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return (sum / ratings.length).toFixed(2);
};

module.exports = mongoose.model('Rating', ratingSchema);
