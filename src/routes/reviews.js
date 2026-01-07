const express = require('express');
const router = express.Router();

const {
  createReview,
  getDoctorReviews,
  getReview,
  markHelpful,
  respondToReview,
  getMyReviews,
  getMyDoctorReviews,
  hideReview,
  unhideReview,
  getMostHelpful
} = require('../controllers/reviewController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/doctor/:doctorId', getDoctorReviews);
router.get('/doctor/:doctorId/helpful', getMostHelpful);
router.get('/:id', getReview);

// Patient routes
router.post('/', protect, authorize('patient'), createReview);
router.get('/my/reviews', protect, authorize('patient'), getMyReviews);

// Doctor routes
router.post('/:id/respond', protect, authorize('doctor'), respondToReview);
router.get('/doctor/my-reviews', protect, authorize('doctor'), getMyDoctorReviews);

// Shared routes (any logged in user)
router.post('/:id/helpful', protect, markHelpful);

// Admin routes
router.put('/:id/hide', protect, authorize('admin'), hideReview);
router.put('/:id/unhide', protect, authorize('admin'), unhideReview);

module.exports = router;