const express = require('express');
const router = express.Router();

const {
  initializePayment,
  paystackWebhook,
  verifyPayment,
  getPayment,
  getMyPayments,
  getDoctorEarnings,
  getPlatformRevenue
} = require('../controllers/paymentController');

const { protect, authorize } = require('../middleware/auth');

// Public routes (Webhook)
router.post('/webhook', paystackWebhook);

// Patient routes
router.post('/initialize', protect, authorize('patient'), initializePayment);
router.get('/my/payments', protect, authorize('patient'), getMyPayments);

// Doctor routes
router.get('/doctor/earnings', protect, authorize('doctor'), getDoctorEarnings);

// Admin routes
router.get('/admin/revenue', protect, authorize('admin'), getPlatformRevenue);

// Shared routes
router.get('/verify/:reference', protect, verifyPayment);
router.get('/:id', protect, getPayment);

module.exports = router;