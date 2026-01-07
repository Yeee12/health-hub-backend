const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getConversation,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  editMessage,
  deleteMessage,
  getConversations,
  searchMessages
} = require('../controllers/messageController');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Send message
router.post('/', authorize('patient', 'doctor'), sendMessage);

// Get conversation list
router.get('/conversations', authorize('patient', 'doctor'), getConversations);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Conversation routes
router.get('/conversation/:appointmentId', authorize('patient', 'doctor'), getConversation);
router.get('/conversation/:appointmentId/search', authorize('patient', 'doctor'), searchMessages);
router.put('/conversation/:appointmentId/read-all', authorize('patient', 'doctor'), markAllAsRead);

// Message actions
router.put('/:id/read', markAsRead);
router.put('/:id', authorize('patient', 'doctor'), editMessage);
router.delete('/:id', authorize('patient', 'doctor'), deleteMessage);

module.exports = router;