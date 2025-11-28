const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { ROLES, BOOKING_STATUS } = require('../config/constants');

class ChatService {
  /**
   * Create or get existing chat for a booking
   */
  async createOrGetChat(bookingId, userId, driverId) {
    // Verify booking exists and belongs to the participants
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Check if booking has required participants
    if (!booking.userId) {
      throw new ValidationError('Booking does not have a user assigned');
    }

    if (!booking.driverId) {
      throw new ValidationError('Booking does not have a driver assigned yet. Please wait for a driver to accept the booking.');
    }

    // Verify the participants match
    if (booking.userId.toString() !== userId.toString() ||
      booking.driverId.toString() !== driverId.toString()) {
      throw new AuthorizationError('You are not authorized to access this chat');
    }

    // Check if chat already exists
    let chat = await Chat.findOne({ bookingId, userId, driverId });

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        bookingId,
        userId,
        driverId,
        isActive: true,
      });

      // Create system message
      await Message.create({
        chatId: chat._id,
        senderId: userId,
        senderModel: 'User',
        senderRole: ROLES.USER,
        messageType: 'system',
        content: 'Chat started. You can now communicate with each other.',
        isRead: true,
        isDelivered: true,
      });
    }

    return chat.populate([
      { path: 'userId', select: 'username phoneNumber' },
      { path: 'driverId', select: 'username phoneNumber vehicleDetails' },
      { path: 'bookingId', select: 'bookingNumber status vehicleType' },
    ]);
  }

  /**
   * Get chat by ID with authorization check
   */
  async getChatById(chatId, requesterId, requesterRole) {
    const chat = await Chat.findById(chatId).populate([
      { path: 'userId', select: 'username phoneNumber' },
      { path: 'driverId', select: 'username phoneNumber vehicleDetails' },
      { path: 'bookingId', select: 'bookingNumber status vehicleType' },
    ]);

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Authorization check
    const isAuthorized =
      (requesterRole === ROLES.USER && chat.userId._id.toString() === requesterId.toString()) ||
      (requesterRole === ROLES.DRIVER && chat.driverId._id.toString() === requesterId.toString());

    if (!isAuthorized) {
      throw new AuthorizationError('You are not authorized to access this chat');
    }

    return chat;
  }

  /**
   * Get all chats for a user
   */
  async getUserChats(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const chats = await Chat.find({ userId, isActive: true })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'driverId', select: 'username phoneNumber vehicleDetails' },
        { path: 'bookingId', select: 'bookingNumber status vehicleType' },
      ]);

    const total = await Chat.countDocuments({ userId, isActive: true });

    return {
      chats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all chats for a driver
   */
  async getDriverChats(driverId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const chats = await Chat.find({ driverId, isActive: true })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'userId', select: 'username phoneNumber' },
        { path: 'bookingId', select: 'bookingNumber status vehicleType' },
      ]);

    const total = await Chat.countDocuments({ driverId, isActive: true });

    return {
      chats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send a message
   */
  async sendMessage(chatId, senderId, senderRole, messageData) {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Verify sender is part of the chat
    const isSenderAuthorized =
      (senderRole === ROLES.USER && chat.userId.toString() === senderId.toString()) ||
      (senderRole === ROLES.DRIVER && chat.driverId.toString() === senderId.toString());

    if (!isSenderAuthorized) {
      throw new AuthorizationError('You are not authorized to send messages in this chat');
    }

    // Determine sender model
    const senderModel = senderRole === ROLES.USER ? 'User' : 'Driver';

    // Create message
    const message = await Message.create({
      chatId,
      senderId,
      senderModel,
      senderRole,
      messageType: messageData.messageType || 'text',
      content: messageData.content,
      imageUrl: messageData.imageUrl,
      location: messageData.location,
      isDelivered: false,
      isRead: false,
    });

    // Update chat with last message info
    chat.lastMessage = messageData.messageType === 'text'
      ? messageData.content
      : `[${messageData.messageType}]`;
    chat.lastMessageAt = new Date();

    // Increment unread count for recipient
    const recipientRole = senderRole === ROLES.USER ? ROLES.DRIVER : ROLES.USER;
    await chat.incrementUnreadCount(recipientRole);

    // Populate sender info
    const populatedMessage = await Message.findById(message._id).populate({
      path: 'senderId',
      select: 'username phoneNumber vehicleDetails',
    });

    return populatedMessage;
  }

  /**
   * Get messages for a chat with pagination
   */
  async getChatMessages(chatId, requesterId, requesterRole, page = 1, limit = 50) {
    // Verify authorization
    await this.getChatById(chatId, requesterId, requesterRole);

    const skip = (page - 1) * limit;

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'senderId',
        select: 'username phoneNumber vehicleDetails',
      });

    const total = await Message.countDocuments({ chatId });

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(chatId, userId, userRole) {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Mark all unread messages from the other party as read
    await Message.markMultipleAsRead(chatId, userId);

    // Reset unread count
    await chat.resetUnreadCount(userRole);

    return { success: true };
  }

  /**
   * Mark message as delivered
   */
  async markMessageAsDelivered(messageId) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    await message.markAsDelivered();
    return message;
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId, userRole) {
    const query = userRole === ROLES.USER ? { userId } : { driverId: userId };

    const chats = await Chat.find(query);

    let totalUnread = 0;
    chats.forEach((chat) => {
      totalUnread += userRole === ROLES.USER ? chat.unreadCountUser : chat.unreadCountDriver;
    });

    return totalUnread;
  }

  /**
   * Delete chat (soft delete)
   */
  async deleteChat(chatId, requesterId, requesterRole) {
    const chat = await this.getChatById(chatId, requesterId, requesterRole);

    chat.isActive = false;
    await chat.save();

    return { success: true };
  }

  /**
   * Get chat by booking ID
   */
  async getChatByBookingId(bookingId, requesterId, requesterRole) {
    const chat = await Chat.findOne({ bookingId, isActive: true }).populate([
      { path: 'userId', select: 'username phoneNumber' },
      { path: 'driverId', select: 'username phoneNumber vehicleDetails' },
      { path: 'bookingId', select: 'bookingNumber status vehicleType' },
    ]);

    if (!chat) {
      throw new NotFoundError('Chat not found for this booking');
    }

    // Authorization check
    const isAuthorized =
      (requesterRole === ROLES.USER && chat.userId._id.toString() === requesterId.toString()) ||
      (requesterRole === ROLES.DRIVER && chat.driverId._id.toString() === requesterId.toString());

    if (!isAuthorized) {
      throw new AuthorizationError('You are not authorized to access this chat');
    }

    return chat;
  }
}

module.exports = new ChatService();
