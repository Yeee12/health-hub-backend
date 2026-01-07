const express = require('express');
const router = express.Router();

const {
  getDoctor,
  getMyProfile,
  updateProfile,
  getAllDoctors,
  searchDoctors,
  findNearbyDoctors,
  verifyDoctor,
  rejectDoctor,
  getPendingDoctors
} = require('../controllers/doctorController');

const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Doctor-only routes (MUST come first)
router.get('/me/profile', protect, authorize('doctor'), getMyProfile);
router.put('/me/profile', protect, authorize('doctor'), updateProfile);

// Admin-only routes (MUST come before public routes)
router.get('/admin/pending', protect, authorize('admin'), getPendingDoctors);
router.put('/:id/verify', protect, authorize('admin'), verifyDoctor);
router.put('/:id/reject', protect, authorize('admin'), rejectDoctor);

// Public routes (specific routes before /:id)
router.get('/search', searchDoctors);
router.get('/nearby', findNearbyDoctors);
router.get('/', getAllDoctors);
router.get('/:id', getDoctor);

module.exports = router;