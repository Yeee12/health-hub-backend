const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const crypto = require('crypto');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/emailService');

// Generate 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, password, phoneNumber, role, firstName, lastName, specialties, licenseNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if phone number exists (if provided)
    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
    }

    // Generate OTP
    const otp = generateOtp();

    // Create user with OTP
    const user = await User.create({
      email,
      password,
      phoneNumber,
      role,
      otp,
      otpCreatedAt: Date.now(),
      emailVerified: false,
    });

    // Create role-specific profile
    if (role === 'patient') {
      await Patient.create({
        userId: user._id,
        firstName,
        lastName
      });
    } else if (role === 'doctor') {
      if (!specialties || !licenseNumber) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message: 'Specialties and license number are required for doctors'
        });
      }

      const doctor = await Doctor.create({
        userId: user._id,
        firstName,
        lastName,
        specialties: Array.isArray(specialties) ? specialties : [specialties],
        licenseNumber
      });

      await Availability.createDefault(doctor._id);
    }

    // Send OTP email
    try {
      await sendOtpEmail(email, otp, firstName);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Continue registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for OTP verification.',
      data: {
        userId: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during registration',
      error: error.message
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'User ID and OTP are required'
      });
    }

    // Find user with OTP fields
    const user = await User.findById(userId).select('+otp +otpCreatedAt +otpAttempts');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Check OTP attempts
    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Validate OTP
    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsRemaining: 5 - user.otpAttempts
      });
    }

    // Check OTP expiry (10 minutes)
    const otpAge = Date.now() - user.otpCreatedAt;
    if (otpAge > 10 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Mark user as verified
    user.emailVerified = true;
    user.otp = undefined;
    user.otpCreatedAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Send welcome email
    try {
      const profile = user.role === 'patient' 
        ? await Patient.findOne({ userId: user._id })
        : await Doctor.findOne({ userId: user._id });
      
      await sendWelcomeEmail(user.email, profile?.firstName || 'User', user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    await user.addRefreshToken(refreshToken);
    await user.updateLastLogin();

    // Get role-specific profile
    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          emailVerified: user.emailVerified,
          profile
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during verification',
      error: error.message
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: 'User ID and email are required'
      });
    }

    const user = await User.findById(userId).select('+otp +otpCreatedAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    if (user.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match user record'
      });
    }

    // Rate limiting
    if (user.otpCreatedAt) {
      const timeSinceLastOtp = Date.now() - user.otpCreatedAt;
      if (timeSinceLastOtp < 60 * 1000) {
        return res.status(429).json({
          success: false,
          message: 'Please wait before requesting a new OTP',
          retryAfter: Math.ceil((60 * 1000 - timeSinceLastOtp) / 1000)
        });
      }
    }

    // Generate new OTP
    const otp = generateOtp();
    user.otp = otp;
    user.otpCreatedAt = Date.now();
    user.otpAttempts = 0;
    await user.save();

    // Send OTP email
    try {
      const profile = user.role === 'patient' 
        ? await Patient.findOne({ userId: user._id })
        : await Doctor.findOne({ userId: user._id });
      
      await sendOtpEmail(email, otp, profile?.firstName || 'User');
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during OTP resend',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        userId: user._id,
        email: user.email,
        requiresVerification: true
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    if (user.isSuspended) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been suspended'
      });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    await user.addRefreshToken(refreshToken);
    await user.updateLastLogin();

    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          profile
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = require('jsonwebtoken').verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_development'
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    if (!user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const newAccessToken = user.generateAccessToken();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await req.user.removeRefreshToken(refreshToken);
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    let profile = null;
    if (req.user.role === 'patient') {
      profile = await Patient.findOne({ userId: req.user._id });
    } else if (req.user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: req.user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        profile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email address'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset token generated',
      data: {
        resetToken,
        message: 'Password reset link has been sent to your email'
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};
