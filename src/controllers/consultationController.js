const Consultation = require('../models/Consultation');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// @desc    Create consultation (after appointment)
// @route   POST /api/consultations
// @access  Private (Doctor only)
exports.createConsultation = async (req, res) => {
  try {
    const {
      appointmentId,
      chiefComplaint,
      historyOfPresentIllness,
      physicalExamination,
      vitals,
      diagnosis,
      differentialDiagnosis,
      prescription,
      recommendedTests,
      followUpRequired,
      followUpDate,
      followUpNotes,
      privateNotes
    } = req.body;

    if (!appointmentId || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID and diagnosis are required'
      });
    }

    // Get appointment
    const appointment = await Appointment.findById(appointmentId);

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

    // Check if appointment is completed
    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Consultation can only be created for completed appointments'
      });
    }

    // Check if consultation already exists
    const existingConsultation = await Consultation.findOne({ appointmentId });
    if (existingConsultation) {
      return res.status(400).json({
        success: false,
        message: 'Consultation already exists for this appointment'
      });
    }

    // Create consultation
    const consultation = await Consultation.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: doctor._id,
      chiefComplaint,
      historyOfPresentIllness,
      physicalExamination,
      vitals,
      diagnosis,
      differentialDiagnosis,
      prescription,
      recommendedTests,
      followUpRequired,
      followUpDate,
      followUpNotes,
      privateNotes
    });

    // Populate data
    await consultation.populate([
      { path: 'patientId', select: 'firstName lastName dateOfBirth' },
      { path: 'doctorId', select: 'firstName lastName specialties' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Consultation created successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Create consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating consultation',
      error: error.message
    });
  }
};

// @desc    Get consultation by ID
// @route   GET /api/consultations/:id
// @access  Private (Patient/Doctor of that consultation)
exports.getConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patientId', 'firstName lastName dateOfBirth gender bloodGroup')
      .populate('doctorId', 'firstName lastName specialties qualifications')
      .populate('appointmentId', 'appointmentDate consultationType');

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check authorization
    const patient = await Patient.findOne({ userId: req.user._id });
    const doctor = await Doctor.findOne({ userId: req.user._id });

    const isAuthorized =
      req.user.role === 'admin' ||
      (patient && consultation.patientId._id.toString() === patient._id.toString()) ||
      (doctor && consultation.doctorId._id.toString() === doctor._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this consultation'
      });
    }

    // Hide private notes from patient
    if (patient && consultation.patientId._id.toString() === patient._id.toString()) {
      consultation.privateNotes = undefined;
    }

    res.status(200).json({
      success: true,
      data: consultation
    });
  } catch (error) {
    console.error('Get consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consultation',
      error: error.message
    });
  }
};

// @desc    Get my consultation history (Patient)
// @route   GET /api/consultations/my/history
// @access  Private (Patient only)
exports.getMyHistory = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const consultations = await Consultation.getPatientHistory(patient._id, 20);

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations
    });
  } catch (error) {
    console.error('Get my history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consultation history',
      error: error.message
    });
  }
};

// @desc    Get consultations by doctor
// @route   GET /api/consultations/doctor/consultations
// @access  Private (Doctor only)
exports.getDoctorConsultations = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const consultations = await Consultation.find({ doctorId: doctor._id })
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('appointmentId', 'appointmentDate consultationType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Consultation.countDocuments({ doctorId: doctor._id });

    res.status(200).json({
      success: true,
      data: consultations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get doctor consultations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consultations',
      error: error.message
    });
  }
};

// @desc    Update consultation (within 24 hours)
// @route   PUT /api/consultations/:id
// @access  Private (Doctor only)
exports.updateConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check if doctor owns this consultation
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || consultation.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if within 24 hours
    const hoursSinceCreation = (Date.now() - consultation.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return res.status(400).json({
        success: false,
        message: 'Consultation can only be edited within 24 hours of creation'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'chiefComplaint',
      'historyOfPresentIllness',
      'physicalExamination',
      'vitals',
      'diagnosis',
      'differentialDiagnosis',
      'prescription',
      'recommendedTests',
      'followUpRequired',
      'followUpDate',
      'followUpNotes',
      'privateNotes'
    ];

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        consultation[key] = req.body[key];
      }
    });

    await consultation.save();

    res.status(200).json({
      success: true,
      message: 'Consultation updated successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Update consultation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating consultation',
      error: error.message
    });
  }
};

// @desc    Add prescription to consultation
// @route   POST /api/consultations/:id/prescription
// @access  Private (Doctor only)
exports.addPrescription = async (req, res) => {
  try {
    const { medication, dosage, frequency, duration, instructions } = req.body;

    if (!medication || !dosage || !frequency || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Medication, dosage, frequency, and duration are required'
      });
    }

    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check authorization
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || consultation.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await consultation.addPrescription({
      medication,
      dosage,
      frequency,
      duration,
      instructions
    });

    res.status(200).json({
      success: true,
      message: 'Prescription added successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Add prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding prescription',
      error: error.message
    });
  }
};

// @desc    Add recommended test
// @route   POST /api/consultations/:id/test
// @access  Private (Doctor only)
exports.addRecommendedTest = async (req, res) => {
  try {
    const { testName, reason, urgent } = req.body;

    if (!testName) {
      return res.status(400).json({
        success: false,
        message: 'Test name is required'
      });
    }

    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    // Check authorization
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || consultation.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await consultation.addRecommendedTest({
      testName,
      reason,
      urgent
    });

    res.status(200).json({
      success: true,
      message: 'Test recommendation added successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Add test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding test recommendation',
      error: error.message
    });
  }
};