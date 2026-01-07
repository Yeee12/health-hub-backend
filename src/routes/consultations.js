const express = require('express');
const router = express.Router();

const {
  createConsultation,
  getConsultation,
  getMyHistory,
  getDoctorConsultations,
  updateConsultation,
  addPrescription,
  addRecommendedTest
} = require('../controllers/consultationController');

const { protect, authorize } = require('../middleware/auth');

// Doctor routes
router.post('/', protect, authorize('doctor'), createConsultation);
router.get('/doctor/consultations', protect, authorize('doctor'), getDoctorConsultations);
router.put('/:id', protect, authorize('doctor'), updateConsultation);
router.post('/:id/prescription', protect, authorize('doctor'), addPrescription);
router.post('/:id/test', protect, authorize('doctor'), addRecommendedTest);

// Patient routes
router.get('/my/history', protect, authorize('patient'), getMyHistory);

// Shared routes
router.get('/:id', protect, getConsultation);

module.exports = router;