const express = require('express');
const router = express.Router();

const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyOtp,      // ADD THIS
  resendOtp       // ADD THIS
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validators');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/verify-otp', verifyOtp);        // ADD THIS
router.post('/resend-otp', resendOtp);        // ADD THIS
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;