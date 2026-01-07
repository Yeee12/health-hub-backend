const express = require('express');
const router = express.Router();

const {
  getMyNotifications,
  getUnreadNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getByType,
  clearOldNotifications
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', getMyNotifications);
router.get('/unread', getUnreadNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/type/:type', getByType);
router.get('/:id', getNotification);

// Mark as read
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);

// Delete
router.delete('/clear-old', clearOldNotifications);
router.delete('/:id', deleteNotification);

// Create (Admin only for testing)
router.post('/', authorize('admin'), createNotification);

module.exports = router;