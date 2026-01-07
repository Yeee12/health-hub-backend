const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// @desc    Create review
// @route   POST /api/reviews
// @access  Private (Patient only)
exports.createReview = async (req, res) => {
  try {
    const { appointmentId, rating, comment, tags } = req.body;

    if (!appointmentId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID and rating are required'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
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

    // Check if patient owns this appointment
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient || appointment.patientId.toString() !== patient._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if appointment is completed
    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed appointments'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ appointmentId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this appointment'
      });
    }

    // Create review
    const review = await Review.create({
      doctorId: appointment.doctorId,
      patientId: patient._id,
      appointmentId,
      rating,
      comment,
      tags
    });

    // Populate data
    await review.populate([
      { path: 'patientId', select: 'firstName lastName profilePicture' },
      { path: 'doctorId', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
};

// @desc    Get reviews for a doctor
// @route   GET /api/reviews/doctor/:doctorId
// @access  Public
exports.getDoctorReviews = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { rating, page = 1, limit = 10 } = req.query;

    const result = await Review.getForDoctor(doctorId, {
      rating: rating ? parseInt(rating) : null,
      page: parseInt(page),
      limit: parseInt(limit),
      includeHidden: false
    });

    // Get rating distribution
    const distribution = await Review.getRatingDistribution(doctorId);

    // Get average rating
    const stats = await Review.getAverageRating(doctorId);

    res.status(200).json({
      success: true,
      data: {
        reviews: result.reviews,
        pagination: result.pagination,
        stats: {
          averageRating: stats.averageRating,
          totalReviews: stats.totalReviews,
          distribution: distribution.distribution
        }
      }
    });
  } catch (error) {
    console.error('Get doctor reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Public
exports.getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('patientId', 'firstName lastName profilePicture')
      .populate('doctorId', 'firstName lastName specialties');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Don't show hidden reviews to public
    if (review.isHidden && req.user?.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review',
      error: error.message
    });
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
exports.markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if already marked helpful
    if (review.markedHelpfulBy.includes(req.user._id)) {
      // Unmark if already marked
      await review.unmarkHelpful(req.user._id);
      
      return res.status(200).json({
        success: true,
        message: 'Review unmarked as helpful',
        data: {
          helpfulCount: review.helpfulCount
        }
      });
    } else {
      // Mark as helpful
      await review.markHelpful(req.user._id);

      return res.status(200).json({
        success: true,
        message: 'Review marked as helpful',
        data: {
          helpfulCount: review.helpfulCount
        }
      });
    }
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
};

// @desc    Doctor responds to review
// @route   POST /api/reviews/:id/respond
// @access  Private (Doctor only)
exports.respondToReview = async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if doctor owns this review
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || review.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await review.respond(response);

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: review
    });
  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error responding to review',
      error: error.message
    });
  }
};

// @desc    Get my reviews (Patient)
// @route   GET /api/reviews/my/reviews
// @access  Private (Patient only)
exports.getMyReviews = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const reviews = await Review.find({ patientId: patient._id })
      .populate('doctorId', 'firstName lastName specialties profilePicture')
      .populate('appointmentId', 'appointmentDate')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// @desc    Get reviews for my appointments (Doctor)
// @route   GET /api/reviews/doctor/my-reviews
// @access  Private (Doctor only)
exports.getMyDoctorReviews = async (req, res) => {
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

    const result = await Review.getForDoctor(doctor._id, {
      page,
      limit,
      includeHidden: true // Doctor can see hidden reviews
    });

    // Get stats
    const stats = await Review.getAverageRating(doctor._id);
    const distribution = await Review.getRatingDistribution(doctor._id);

    res.status(200).json({
      success: true,
      data: {
        reviews: result.reviews,
        pagination: result.pagination,
        stats: {
          averageRating: stats.averageRating,
          totalReviews: stats.totalReviews,
          distribution: distribution.distribution
        }
      }
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// @desc    Hide review (Admin only)
// @route   PUT /api/reviews/:id/hide
// @access  Private (Admin only)
exports.hideReview = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for hiding is required'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    await review.hide(req.user._id, reason);

    res.status(200).json({
      success: true,
      message: 'Review hidden successfully',
      data: review
    });
  } catch (error) {
    console.error('Hide review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error hiding review',
      error: error.message
    });
  }
};

// @desc    Unhide review (Admin only)
// @route   PUT /api/reviews/:id/unhide
// @access  Private (Admin only)
exports.unhideReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    await review.unhide();

    res.status(200).json({
      success: true,
      message: 'Review unhidden successfully',
      data: review
    });
  } catch (error) {
    console.error('Unhide review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error unhiding review',
      error: error.message
    });
  }
};

// @desc    Get most helpful reviews for a doctor
// @route   GET /api/reviews/doctor/:doctorId/helpful
// @access  Public
exports.getMostHelpful = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const reviews = await Review.getMostHelpful(doctorId, limit);

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Get most helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};