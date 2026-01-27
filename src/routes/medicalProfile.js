// src/routes/medicalProfile.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createMedicalProfile,
  getMedicalProfile,
  updateMedicalProfile,
  deleteMedicalProfile,
} = require('../controllers/medicalProfileController');

// All routes require authentication
router.use(protect);

router.route('/')
  .post(createMedicalProfile)
  .get(getMedicalProfile)
  .put(updateMedicalProfile)
  .delete(deleteMedicalProfile);

module.exports = router;