const Patient = require('../models/Patient');
const User = require('../models/User');

// @desc    Get patient profile
// @route   GET /api/patients/:id
// @access  Private
exports.getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('userId', 'email phoneNumber profilePicture');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient',
      error: error.message
    });
  }
};

// @desc    Get current patient profile
// @route   GET /api/patients/me
// @access  Private (Patient only)
exports.getMyProfile = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id }).populate('userId', 'email phoneNumber profilePicture');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// @desc    Update patient profile
// @route   PUT /api/patients/me
// @access  Private (Patient only)
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'bloodGroup',
      'address',
      'allergies',
      'currentMedications',
      'emergencyContact'
    ];

    // Filter request body to only allowed fields
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const patient = await Patient.findOneAndUpdate(
      { userId: req.user._id },
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'email phoneNumber profilePicture');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: patient
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Add medical history entry
// @route   POST /api/patients/me/medical-history
// @access  Private (Patient only)
exports.addMedicalHistory = async (req, res) => {
  try {
    const { condition, diagnosedDate, notes } = req.body;

    if (!condition) {
      return res.status(400).json({
        success: false,
        message: 'Condition is required'
      });
    }

    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    await patient.addMedicalHistory({ condition, diagnosedDate, notes });

    res.status(200).json({
      success: true,
      message: 'Medical history added successfully',
      data: patient
    });
  } catch (error) {
    console.error('Add medical history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding medical history',
      error: error.message
    });
  }
};

// @desc    Update emergency contact
// @route   PUT /api/patients/me/emergency-contact
// @access  Private (Patient only)
exports.updateEmergencyContact = async (req, res) => {
  try {
    const { name, relationship, phoneNumber } = req.body;

    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    await patient.updateEmergencyContact({ name, relationship, phoneNumber });

    res.status(200).json({
      success: true,
      message: 'Emergency contact updated successfully',
      data: patient
    });
  } catch (error) {
    console.error('Update emergency contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating emergency contact',
      error: error.message
    });
  }
};

// @desc    Get all patients (Admin only)
// @route   GET /api/patients
// @access  Private (Admin only)
exports.getAllPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const patients = await Patient.find()
      .populate('userId', 'email phoneNumber profilePicture isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Patient.countDocuments();

    res.status(200).json({
      success: true,
      data: patients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patients',
      error: error.message
    });
  }
};

// @desc    Search patients
// @route   GET /api/patients/search
// @access  Private (Admin/Doctor)
exports.searchPatients = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const patients = await Patient.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } }
      ]
    })
      .populate('userId', 'email phoneNumber')
      .limit(20);

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching patients',
      error: error.message
    });
  }
};