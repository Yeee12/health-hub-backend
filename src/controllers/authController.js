const authService = require('../services/authService');
const otpService = require('../services/otpService');
const tokenService = require('../services/tokenService');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error during registration',
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const result = await otpService.verifyOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error during verification',
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res) => {
  try {
    const result = await otpService.resendOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error during OTP resend',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error during login',
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const result = await tokenService.refreshAccessToken(req.body.refreshToken);
    res.status(200).json(result);
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    await authService.logoutUser(req.user, req.body.refreshToken);
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const result = await authService.getCurrentUser(req.user);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error processing request',
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error resetting password',
    });
  }
};
