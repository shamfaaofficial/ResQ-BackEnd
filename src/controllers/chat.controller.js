const asyncHandler = require('express-async-handler');
const chatService = require('../services/chat.service');
const { ValidationError } = require('../utils/errors');

/**
 * @route   POST /api/v1/chat
 * @desc    Create or get chat for a booking
 * @access  Private (User or Driver)
 */
exports.createOrGetChat = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const { userId, role } = req.user;

  if (!bookingId) {
    throw new ValidationError('Booking ID is required');
  }

  // For drivers, the userId in JWT is their driver ID
  const driverId = role === 'driver' ? userId : req.body.driverId;
  const actualUserId = role === 'user' ? userId : req.body.userId;

  const chat = await chatService.createOrGetChat(bookingId, actualUserId, driverId);

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
  const { userId, role } = req.user;

  const chat = await chatService.getChatById(chatId, userId, role);

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
  const { userId, role } = req.user;

  const chat = await chatService.getChatByBookingId(bookingId, userId, role);

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
  const { userId, role } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  let result;
  if (role === 'user') {
    result = await chatService.getUserChats(userId, page, limit);
  } else if (role === 'driver') {
    result = await chatService.getDriverChats(userId, page, limit);
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
  const { userId, role } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const result = await chatService.getChatMessages(chatId, userId, role, page, limit);

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
  const { userId, role } = req.user;
  const { messageType, content, imageUrl, location } = req.body;

  const message = await chatService.sendMessage(chatId, userId, role, {
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
  const { userId, role } = req.user;

  const result = await chatService.markMessagesAsRead(chatId, userId, role);

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
  const { userId, role } = req.user;

  const unreadCount = await chatService.getUnreadCount(userId, role);

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
  const { userId, role } = req.user;

  const result = await chatService.deleteChat(chatId, userId, role);

  res.status(200).json({
    success: true,
    data: result,
  });
});
