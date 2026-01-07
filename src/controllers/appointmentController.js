const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Availability = require('../models/Availability');

// @desc    Get available slots for a doctor on a specific date
// @route   GET /api/appointments/available-slots
// @access  Public
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and date are required'
      });
    }

    // Get doctor's availability
    const availability = await Availability.findOne({ doctorId });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Doctor availability not found'
      });
    }

    // Get all available slots for the date
    const allSlots = availability.getAvailableSlotsForDate(new Date(date));

    // Get existing appointments for that date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    // Filter out booked slots
    const bookedTimes = bookedAppointments.map(apt => {
      const date = new Date(apt.appointmentDate);
      return date.toTimeString().slice(0, 5); // HH:MM format
    });

    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    res.status(200).json({
      success: true,
      data: {
        date,
        totalSlots: allSlots.length,
        availableSlots: availableSlots.length,
        slots: availableSlots
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available slots',
      error: error.message
    });
  }
};

// @desc    Book an appointment
// @route   POST /api/appointments
// @access  Private (Patient only)
exports.bookAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      consultationType,
      reasonForVisit,
      symptoms,
      isFollowUp,
      previousAppointmentId
    } = req.body;

    // Validate required fields
    if (!doctorId || !appointmentDate || !consultationType || !reasonForVisit) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID, appointment date, consultation type, and reason for visit are required'
      });
    }

    // Get patient
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    // Get doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check if doctor is verified
    if (doctor.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Doctor is not verified'
      });
    }

    // Validate consultation type
    if (!doctor.consultationTypes.includes(consultationType)) {
      return res.status(400).json({
        success: false,
        message: `Doctor does not offer ${consultationType} consultations`
      });
    }

    // Get consultation fee
    const consultationFee = doctor.consultationFee[consultationType === 'in-person' ? 'inPerson' : consultationType];

    // Check if appointment date is in the future
    if (new Date(appointmentDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date must be in the future'
      });
    }

    // Check doctor availability
    const availability = await Availability.findOne({ doctorId });
    if (!availability) {
      return res.status(400).json({
        success: false,
        message: 'Doctor availability not configured'
      });
    }

    const isAvailable = availability.isAvailableAt(new Date(appointmentDate));
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is not available at this time'
      });
    }

    // Check for conflicts
    const hasConflict = await Appointment.hasConflict(
      doctorId,
      new Date(appointmentDate),
      availability.slotDuration
    );

    if (hasConflict) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId,
      appointmentDate: new Date(appointmentDate),
      duration: availability.slotDuration,
      consultationType,
      reasonForVisit,
      symptoms: symptoms || [],
      consultationFee,
      isFollowUp: isFollowUp || false,
      previousAppointmentId: previousAppointmentId || null
    });

    // Increment appointment counts
    await patient.incrementAppointmentCount();
    await doctor.incrementAppointmentCount();

    // Populate data for response
    await appointment.populate([
      { path: 'patientId', select: 'firstName lastName' },
      { path: 'doctorId', select: 'firstName lastName specialties' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error booking appointment',
      error: error.message
    });
  }
};

// @desc    Get appointment by ID
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'firstName lastName phoneNumber')
      .populate('doctorId', 'firstName lastName specialties consultationFee')
      .populate('paymentId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const patient = await Patient.findOne({ userId: req.user._id });
    const doctor = await Doctor.findOne({ userId: req.user._id });

    const isAuthorized =
      req.user.role === 'admin' ||
      (patient && appointment.patientId._id.toString() === patient._id.toString()) ||
      (doctor && appointment.doctorId._id.toString() === doctor._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment',
      error: error.message
    });
  }
};

// @desc    Get my appointments (Patient)
// @route   GET /api/appointments/my/appointments
// @access  Private (Patient only)
exports.getMyAppointments = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const { status, upcoming } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { patientId: patient._id };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.appointmentDate = { $gte: new Date() };
      query.status = { $in: ['pending', 'confirmed'] };
    }

    const appointments = await Appointment.find(query)
      .populate('doctorId', 'firstName lastName specialties profilePicture averageRating')
      .sort({ appointmentDate: upcoming === 'true' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// @desc    Get doctor appointments
// @route   GET /api/appointments/doctor/appointments
// @access  Private (Doctor only)
exports.getDoctorAppointments = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    const { status, date } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { doctorId: doctor._id };

    if (status) {
      query.status = status;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'firstName lastName phoneNumber profilePicture')
      .sort({ appointmentDate: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get doctor appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// @desc    Confirm appointment (Doctor)
// @route   PUT /api/appointments/:id/confirm
// @access  Private (Doctor only)
exports.confirmAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if doctor owns this appointment
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm appointment with status: ${appointment.status}`
      });
    }

    await appointment.confirm(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Appointment confirmed',
      data: appointment
    });
  } catch (error) {
    console.error('Confirm appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming appointment',
      error: error.message
    });
  }
};

// @desc    Cancel appointment
// @route   PUT /api/appointments/:id/cancel
// @access  Private (Patient/Doctor)
exports.cancelAppointment = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const patient = await Patient.findOne({ userId: req.user._id });
    const doctor = await Doctor.findOne({ userId: req.user._id });

    const isAuthorized =
      (patient && appointment.patientId.toString() === patient._id.toString()) ||
      (doctor && appointment.doctorId.toString() === doctor._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    // Check if can be cancelled
    if (!appointment.canBeCancelled(24)) {
      return res.status(400).json({
        success: false,
        message: 'Appointment can only be cancelled at least 24 hours before the scheduled time'
      });
    }

    await appointment.cancel(req.user._id, reason);

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment',
      error: error.message
    });
  }
};

// @desc    Get upcoming appointments (for dashboard)
// @route   GET /api/appointments/upcoming
// @access  Private
exports.getUpcomingAppointments = async (req, res) => {
  try {
    let appointments;

    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      appointments = await Appointment.getUpcomingForPatient(patient._id, 5);
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      appointments = await Appointment.getUpcomingForDoctor(doctor._id, 5);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming appointments',
      error: error.message
    });
  }
};