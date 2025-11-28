const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const chatSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCountUser: {
      type: Number,
      default: 0,
    },
    unreadCountDriver: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
chatSchema.index({ bookingId: 1, userId: 1, driverId: 1 }, { unique: true });
chatSchema.index({ userId: 1, isActive: 1 });
chatSchema.index({ driverId: 1, isActive: 1 });
chatSchema.index({ lastMessageAt: -1 });

// Instance method to reset unread count
chatSchema.methods.resetUnreadCount = function (role) {
  if (role === ROLES.USER) {
    this.unreadCountUser = 0;
  } else if (role === ROLES.DRIVER) {
    this.unreadCountDriver = 0;
  }
  return this.save();
};

// Instance method to increment unread count
chatSchema.methods.incrementUnreadCount = function (recipientRole) {
  if (recipientRole === ROLES.USER) {
    this.unreadCountUser += 1;
  } else if (recipientRole === ROLES.DRIVER) {
    this.unreadCountDriver += 1;
  }
  return this.save();
};

module.exports = mongoose.model('Chat', chatSchema);
