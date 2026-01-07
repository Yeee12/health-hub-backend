const express = require('express');
const router = express.Router();

const {
  getAvailableSlots,
  bookAppointment,
  getAppointment,
  getMyAppointments,
  getDoctorAppointments,
  confirmAppointment,
  cancelAppointment,
  getUpcomingAppointments
} = require('../controllers/appointmentController');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/available-slots', getAvailableSlots);

// Patient routes
router.post('/', protect, authorize('patient'), bookAppointment);
router.get('/my/appointments', protect, authorize('patient'), getMyAppointments);

// Doctor routes
router.get('/doctor/appointments', protect, authorize('doctor'), getDoctorAppointments);
router.put('/:id/confirm', protect, authorize('doctor'), confirmAppointment);

// Shared routes (Patient/Doctor)
router.get('/upcoming', protect, authorize('patient', 'doctor'), getUpcomingAppointments);
router.get('/:id', protect, getAppointment);
router.put('/:id/cancel', protect, authorize('patient', 'doctor'), cancelAppointment);

module.exports = router;