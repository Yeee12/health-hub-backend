const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Availability = require('../models/Availability');

// @desc    Get doctor profile
// @route   GET /api/doctors/:id
// @access  Public
exports.getDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('userId', 'email phoneNumber profilePicture');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Don't show unverified doctors to public
    if (doctor.verificationStatus !== 'verified') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctor',
      error: error.message
    });
  }
};

// @desc    Get current doctor profile
// @route   GET /api/doctors/me
// @access  Private (Doctor only)
exports.getMyProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id })
      .populate('userId', 'email phoneNumber profilePicture');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: doctor
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

// @desc    Update doctor profile
// @route   PUT /api/doctors/me
// @access  Private (Doctor only)
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'gender',
      'dateOfBirth',
      'specialties',
      'yearsOfExperience',
      'qualifications',
      'hospitalAffiliations',
      'clinicAddress',
      'consultationFee',
      'consultationTypes',
      'about',
      'languages',
      'bankDetails'
    ];

    // Filter request body
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Don't allow changing verification status or license
    delete updates.verificationStatus;
    delete updates.licenseNumber;

    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'email phoneNumber profilePicture');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: doctor
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

// @desc    Get all doctors
// @route   GET /api/doctors
// @access  Public
exports.getAllDoctors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const filters = { verificationStatus: 'verified' };

    if (req.query.specialty) {
      filters.specialties = { $in: [req.query.specialty] };
    }

    if (req.query.minRating) {
      filters.averageRating = { $gte: parseFloat(req.query.minRating) };
    }

    // Sorting
    let sort = { averageRating: -1 }; // Default: highest rated first
    if (req.query.sort === 'experience') {
      sort = { yearsOfExperience: -1 };
    } else if (req.query.sort === 'newest') {
      sort = { createdAt: -1 };
    }

    const doctors = await Doctor.find(filters)
      .populate('userId', 'email profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-bankDetails'); // Hide bank details from public

    const total = await Doctor.countDocuments(filters);

    res.status(200).json({
      success: true,
      data: doctors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctors',
      error: error.message
    });
  }
};

// @desc    Search doctors
// @route   GET /api/doctors/search
// @access  Public
exports.searchDoctors = async (req, res) => {
  try {
    const { query, specialty, location } = req.query;

    const filters = { verificationStatus: 'verified' };

    if (query) {
      filters.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { specialties: { $regex: query, $options: 'i' } }
      ];
    }

    if (specialty) {
      filters.specialties = { $in: [specialty] };
    }

    if (location) {
      filters['clinicAddress.city'] = { $regex: location, $options: 'i' };
    }

    const doctors = await Doctor.find(filters)
      .populate('userId', 'email profilePicture')
      .sort({ averageRating: -1 })
      .limit(20)
      .select('-bankDetails');

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (error) {
    console.error('Search doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching doctors',
      error: error.message
    });
  }
};

// @desc    Find doctors near location
// @route   GET /api/doctors/nearby
// @access  Public
exports.findNearbyDoctors = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const doctors = await Doctor.find({
      verificationStatus: 'verified',
      'clinicAddress.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    })
      .populate('userId', 'email profilePicture')
      .limit(20)
      .select('-bankDetails');

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (error) {
    console.error('Find nearby doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby doctors',
      error: error.message
    });
  }
};

// @desc    Verify doctor (Admin only)
// @route   PUT /api/doctors/:id/verify
// @access  Private (Admin only)
exports.verifyDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    await doctor.verify(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Doctor verified successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Verify doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying doctor',
      error: error.message
    });
  }
};

// @desc    Reject doctor (Admin only)
// @route   PUT /api/doctors/:id/reject
// @access  Private (Admin only)
exports.rejectDoctor = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    await doctor.reject(reason);

    res.status(200).json({
      success: true,
      message: 'Doctor application rejected',
      data: doctor
    });
  } catch (error) {
    console.error('Reject doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting doctor',
      error: error.message
    });
  }
};

// @desc    Get pending doctors (Admin only)
// @route   GET /api/doctors/pending
// @access  Private (Admin only)
exports.getPendingDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ verificationStatus: 'pending' })
      .populate('userId', 'email phoneNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (error) {
    console.error('Get pending doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending doctors',
      error: error.message
    });
  }
};