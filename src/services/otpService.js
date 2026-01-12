const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/emailService');

// Generate 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

class OtpService {
  async verifyOtp(data) {
    const { userId, otp } = data;

    if (!userId || !otp) {
      const error = new Error('User ID and OTP are required');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(userId).select('+otp +otpCreatedAt +otpAttempts');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.emailVerified) {
      const error = new Error('Email is already verified');
      error.statusCode = 400;
      throw error;
    }

    if (user.otpAttempts >= 5) {
      const error = new Error('Too many failed attempts. Please request a new OTP.');
      error.statusCode = 429;
      throw error;
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      const error = new Error('Invalid OTP');
      error.statusCode = 400;
      error.attemptsRemaining = 5 - user.otpAttempts;
      throw error;
    }

    const otpAge = Date.now() - user.otpCreatedAt;
    if (otpAge > 10 * 60 * 1000) {
      const error = new Error('OTP has expired. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }

    user.emailVerified = true;
    user.otp = undefined;
    user.otpCreatedAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Send welcome email
    try {
      const profile =
        user.role === 'patient'
          ? await Patient.findOne({ userId: user._id })
          : await Doctor.findOne({ userId: user._id });

      await sendWelcomeEmail(user.email, profile?.firstName || 'User', user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
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

    return {
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          emailVerified: user.emailVerified,
          profile,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    };
  }

  async resendOtp(data) {
    const { email, userId } = data;

    if (!userId || !email) {
      const error = new Error('User ID and email are required');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(userId).select('+otp +otpCreatedAt');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.emailVerified) {
      const error = new Error('Email is already verified');
      error.statusCode = 400;
      throw error;
    }

    if (user.email !== email) {
      const error = new Error('Email does not match user record');
      error.statusCode = 400;
      throw error;
    }

    if (user.otpCreatedAt) {
      const timeSinceLastOtp = Date.now() - user.otpCreatedAt;
      if (timeSinceLastOtp < 60 * 1000) {
        const error = new Error('Please wait before requesting a new OTP');
        error.statusCode = 429;
        error.retryAfter = Math.ceil((60 * 1000 - timeSinceLastOtp) / 1000);
        throw error;
      }
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpCreatedAt = Date.now();
    user.otpAttempts = 0;
    await user.save();

    try {
      const profile =
        user.role === 'patient'
          ? await Patient.findOne({ userId: user._id })
          : await Doctor.findOne({ userId: user._id });

      await sendOtpEmail(email, otp, profile?.firstName || 'User');
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      const error = new Error('Failed to send OTP email. Please try again later.');
      error.statusCode = 500;
      throw error;
    }

    // Include OTP in development mode
    const response = {
      success: true,
      message: 'OTP sent successfully to your email',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.data = { otp };
      console.log('⚠️ DEV MODE: OTP included in response:', otp);
    }

    return response;
  }
}

module.exports = new OtpService();