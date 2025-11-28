const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middlewares/auth');

// All routes require authentication
router.use(authMiddleware);

// Create or get chat for a booking
router.post(
  '/',
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
  chatController.getChatByBookingId
);

// Get chat by ID
router.get(
  '/:chatId',
  chatController.getChatById
);

// Get messages for a chat
router.get(
  '/:chatId/messages',
  chatController.getChatMessages
);

// Send a message (REST fallback)
router.post(
  '/:chatId/messages',
  chatController.sendMessage
);

// Mark messages as read
router.put(
  '/:chatId/read',
  chatController.markMessagesAsRead
);

// Delete chat
router.delete(
  '/:chatId',
  chatController.deleteChat
);

module.exports = router;
