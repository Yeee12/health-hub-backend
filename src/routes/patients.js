const express = require('express');
const router = express.Router();

const {
  getPatient,
  getMyProfile,
  updateProfile,
  addMedicalHistory,
  updateEmergencyContact,
  getAllPatients,
  searchPatients
} = require('../controllers/patientController');

const { protect, authorize } = require('../middleware/auth');

// Patient-only routes (MUST come first - before /:id route)
router.get('/me/profile', protect, authorize('patient'), getMyProfile);
router.put('/me/profile', protect, authorize('patient'), updateProfile);
router.post('/me/medical-history', protect, authorize('patient'), addMedicalHistory);
router.put('/me/emergency-contact', protect, authorize('patient'), updateEmergencyContact);

// Public/Admin routes
router.get('/search', protect, authorize('admin', 'doctor'), searchPatients);
router.get('/', protect, authorize('admin'), getAllPatients);
router.get('/:id', protect, getPatient);

module.exports = router;