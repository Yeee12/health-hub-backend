// src/controllers/medicalProfileController.js
const MedicalProfile = require('../models/MedicalProfile');
const User = require('../models/User');

// @desc    Create medical profile
// @route   POST /api/medical-profile
// @access  Private
exports.createMedicalProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    // Check if profile already exists
    const existingProfile = await MedicalProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Medical profile already exists. Use PUT to update.',
      });
    }

    // Create new profile
    const profile = await MedicalProfile.create({
      userId,
      ...req.body,
    });

    // Update user's medicalProfileId
    await User.findByIdAndUpdate(userId, { medicalProfileId: profile._id });

    res.status(201).json({
      success: true,
      message: 'Medical profile created successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Create medical profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medical profile',
      error: error.message,
    });
  }
};

// @desc    Get medical profile
// @route   GET /api/medical-profile
// @access  Private
exports.getMedicalProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await MedicalProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Medical profile not found',
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Get medical profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medical profile',
      error: error.message,
    });
  }
};

// @desc    Update medical profile
// @route   PUT /api/medical-profile
// @access  Private
exports.updateMedicalProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    let profile = await MedicalProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Medical profile not found. Use POST to create.',
      });
    }

    // Update profile
    profile = await MedicalProfile.findOneAndUpdate(
      { userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Medical profile updated successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Update medical profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical profile',
      error: error.message,
    });
  }
};

// @desc    Delete medical profile
// @route   DELETE /api/medical-profile
// @access  Private
exports.deleteMedicalProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await MedicalProfile.findOneAndDelete({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Medical profile not found',
      });
    }

    // Remove reference from user
    await User.findByIdAndUpdate(userId, { medicalProfileId: null });

    res.status(200).json({
      success: true,
      message: 'Medical profile deleted successfully',
    });
  } catch (error) {
    console.error('Delete medical profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medical profile',
      error: error.message,
    });
  }
};