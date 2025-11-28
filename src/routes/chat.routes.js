const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const chatValidation = require('../validations/chat.validation');

// All routes require authentication
router.use(authMiddleware);

// Create or get chat for a booking
router.post(
  '/',
  validate(chatValidation.createOrGetChat),
  chatController.createOrGetChat
);

// Get unread message count
router.get(
  '/unread/count',
  chatController.getUnreadCount
);

// Get all chats for authenticated user
router.get(
  '/',
  chatController.getChats
);

// Get chat by booking ID
router.get(
  '/booking/:bookingId',
  validate(chatValidation.getChatByBookingId),
  chatController.getChatByBookingId
);

// Get chat by ID
router.get(
  '/:chatId',
  validate(chatValidation.chatIdParam),
  chatController.getChatById
);

// Get messages for a chat
router.get(
  '/:chatId/messages',
  validate(chatValidation.getChatMessages),
  chatController.getChatMessages
);

// Send a message (REST fallback)
router.post(
  '/:chatId/messages',
  validate(chatValidation.sendMessage),
  chatController.sendMessage
);

// Mark messages as read
router.put(
  '/:chatId/read',
  validate(chatValidation.chatIdParam),
  chatController.markMessagesAsRead
);

// Delete chat
router.delete(
  '/:chatId',
  validate(chatValidation.chatIdParam),
  chatController.deleteChat
);

module.exports = router;
