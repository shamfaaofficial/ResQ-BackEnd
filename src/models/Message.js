const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'senderModel',
      index: true,
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'Driver'],
    },
    senderRole: {
      type: String,
      required: true,
      enum: [ROLES.USER, ROLES.DRIVER],
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'location', 'system'],
      default: 'text',
    },
    content: {
      type: String,
      required: function () {
        return this.messageType === 'text' || this.messageType === 'system';
      },
      maxlength: 2000,
    },
    imageUrl: {
      type: String,
      required: function () {
        return this.messageType === 'image';
      },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      address: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ isRead: 1, chatId: 1 });

// GeoJSON index for location messages
messageSchema.index({ 'location.coordinates': '2dsphere' });

// Instance method to mark as delivered
messageSchema.methods.markAsDelivered = function () {
  this.isDelivered = true;
  this.deliveredAt = new Date();
  return this.save();
};

// Instance method to mark as read
messageSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to mark multiple messages as read
messageSchema.statics.markMultipleAsRead = async function (chatId, recipientId) {
  const result = await this.updateMany(
    {
      chatId,
      senderId: { $ne: recipientId },
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );
  return result;
};

module.exports = mongoose.model('Message', messageSchema);
