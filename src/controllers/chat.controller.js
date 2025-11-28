const asyncHandler = require('express-async-handler');
const chatService = require('../services/chat.service');
const { ValidationError } = require('../utils/errors');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');

/**
 * Helper to get driver ID from user ID
 */
const getDriverId = async (userId) => {
  const driver = await Driver.findOne({ userId });
  if (!driver) {
    throw new ValidationError('Driver profile not found');
  }
  return driver._id;
};

/**
 * @route   POST /api/v1/chat
 * @desc    Create or get chat for a booking
 * @access  Private (User or Driver)
 */
exports.createOrGetChat = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const requesterId = req.userId;  // User ID from auth middleware
  const role = req.userRole;       // Role from auth middleware

  // Validate required fields
  if (!bookingId) {
    throw new ValidationError('Booking ID is required');
  }

  if (!requesterId) {
    throw new ValidationError('User authentication failed. Please login again.');
  }

  if (!role) {
    throw new ValidationError('User role not found. Please login again.');
  }

  // First, fetch the booking to get userId and driverId
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new ValidationError('Booking not found');
  }

  // Validate booking has required fields
  if (!booking.userId) {
    throw new ValidationError('Booking does not have a user assigned');
  }

  if (!booking.driverId) {
    throw new ValidationError('Booking does not have a driver assigned yet. Please wait for a driver to accept the booking.');
  }

  // Resolve actual participant ID based on role
  let participantId = requesterId;
  if (role === 'driver') {
    participantId = await getDriverId(requesterId);
  }

  // Verify the requester is part of this booking
  const isUser = role === 'user' && booking.userId.toString() === participantId.toString();
  const isDriver = role === 'driver' && booking.driverId.toString() === participantId.toString();

  if (!isUser && !isDriver) {
    throw new ValidationError('You are not authorized to access this chat');
  }

  // Use the IDs from the booking
  const chat = await chatService.createOrGetChat(bookingId, booking.userId, booking.driverId);

  res.status(200).json({
    success: true,
    data: { chat },
  });
});

/**
 * @route   GET /api/v1/chat/:chatId
 * @desc    Get chat by ID
 * @access  Private (User or Driver)
 */
exports.getChatById = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const chat = await chatService.getChatById(chatId, participantId, role);

  res.status(200).json({
    success: true,
    data: { chat },
  });
});

/**
 * @route   GET /api/v1/chat/booking/:bookingId
 * @desc    Get chat by booking ID
 * @access  Private (User or Driver)
 */
exports.getChatByBookingId = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const chat = await chatService.getChatByBookingId(bookingId, participantId, role);

  res.status(200).json({
    success: true,
    data: { chat },
  });
});

/**
 * @route   GET /api/v1/chat
 * @desc    Get all chats for authenticated user
 * @access  Private (User or Driver)
 */
exports.getChats = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const role = req.userRole;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  let result;
  if (role === 'user') {
    result = await chatService.getUserChats(userId, page, limit);
  } else if (role === 'driver') {
    const driverId = await getDriverId(userId);
    result = await chatService.getDriverChats(driverId, page, limit);
  }

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @route   GET /api/v1/chat/:chatId/messages
 * @desc    Get messages for a chat
 * @access  Private (User or Driver)
 */
exports.getChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;
  const role = req.userRole;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const result = await chatService.getChatMessages(chatId, participantId, role, page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @route   POST /api/v1/chat/:chatId/messages
 * @desc    Send a message (REST fallback, prefer Socket.IO)
 * @access  Private (User or Driver)
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;
  const role = req.userRole;
  const { messageType, content, imageUrl, location } = req.body;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const message = await chatService.sendMessage(chatId, participantId, role, {
    messageType: messageType || 'text',
    content,
    imageUrl,
    location,
  });

  res.status(201).json({
    success: true,
    data: { message },
  });
});

/**
 * @route   PUT /api/v1/chat/:chatId/read
 * @desc    Mark messages as read
 * @access  Private (User or Driver)
 */
exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const result = await chatService.markMessagesAsRead(chatId, participantId, role);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @route   GET /api/v1/chat/unread/count
 * @desc    Get unread message count
 * @access  Private (User or Driver)
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const role = req.userRole;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const unreadCount = await chatService.getUnreadCount(participantId, role);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
});

/**
 * @route   DELETE /api/v1/chat/:chatId
 * @desc    Delete chat (soft delete)
 * @access  Private (User or Driver)
 */
exports.deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  let participantId = userId;
  if (role === 'driver') {
    participantId = await getDriverId(userId);
  }

  const result = await chatService.deleteChat(chatId, participantId, role);

  res.status(200).json({
    success: true,
    data: result,
  });
});
