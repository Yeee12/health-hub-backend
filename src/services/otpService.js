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
    // ⚡ CRITICAL FIX: Accept both userId and email for flexibility
    const { userId, email, otp } = data;

    if (!otp) {
      const error = new Error('OTP is required');
      error.statusCode = 400;
      throw error;
    }

    if (!userId && !email) {
      const error = new Error('User ID or email is required');
      error.statusCode = 400;
      throw error;
    }

    // Find user by either userId or email
    let user;
    if (userId) {
      user = await User.findById(userId).select('+otp +otpCreatedAt +otpAttempts');
    } else {
      user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpCreatedAt +otpAttempts');
    }

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

    // Check for too many attempts
    if (user.otpAttempts >= 5) {
      const error = new Error('Too many failed attempts. Please request a new OTP.');
      error.statusCode = 429;
      throw error;
    }

    // Verify OTP
    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      const error = new Error('Invalid OTP');
      error.statusCode = 400;
      error.attemptsRemaining = 5 - user.otpAttempts;
      throw error;
    }

    // Check if OTP is expired (10 minutes)
    const otpAge = Date.now() - user.otpCreatedAt;
    if (otpAge > 10 * 60 * 1000) {
      const error = new Error('OTP has expired. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }

    // Mark email as verified and clear OTP
    user.emailVerified = true;
    user.otp = undefined;
    user.otpCreatedAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    console.log(`✅ Email verified successfully: ${user.email}`);

    // Get user profile
    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: user._id });
    }

    // Send welcome email asynchronously (don't block response)
    sendWelcomeEmail(user.email, profile?.firstName || 'User', user.role)
      .then((result) => {
        if (result && result.success) {
          console.log('✅ Welcome email sent to:', user.email);
        }
      })
      .catch((emailError) => {
        console.error('❌ Failed to send welcome email:', emailError);
      });

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    await user.addRefreshToken(refreshToken);
    await user.updateLastLogin();

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
    // ⚡ CRITICAL FIX: Accept both userId and email
    const { email, userId } = data;

    if (!userId && !email) {
      const error = new Error('User ID or email is required');
      error.statusCode = 400;
      throw error;
    }

    // Find user by either userId or email
    let user;
    if (userId) {
      user = await User.findById(userId).select('+otp +otpCreatedAt');
    } else {
      user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpCreatedAt');
    }

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

    // Rate limiting - prevent spam (60 seconds between requests)
    if (user.otpCreatedAt) {
      const timeSinceLastOtp = Date.now() - user.otpCreatedAt;
      if (timeSinceLastOtp < 60 * 1000) {
        const error = new Error('Please wait before requesting a new OTP');
        error.statusCode = 429;
        error.retryAfter = Math.ceil((60 * 1000 - timeSinceLastOtp) / 1000);
        throw error;
      }
    }

    // Generate new OTP
    const otp = generateOtp();
    user.otp = otp;
    user.otpCreatedAt = Date.now();
    user.otpAttempts = 0; // Reset attempts
    await user.save();

    console.log(`🔐 New OTP generated for ${user.email}: ${otp}`);

    // Get user profile for personalized email
    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: user._id });
    }

    // Send OTP email with retry logic
    const emailResult = await sendOtpEmail(user.email, otp, profile?.firstName || 'User');

    // Build response
    const response = {
      success: true,
      message: emailResult.success 
        ? 'OTP sent successfully to your email'
        : 'OTP generated but email delivery may be delayed. Please check your inbox.',
    };

    // Include OTP in development mode for easy testing
    if (process.env.NODE_ENV !== 'production') {
      response.data = { otp };
      console.log('⚠️ DEV MODE: OTP included in response:', otp);
    }

    // Log email sending result
    if (!emailResult.success) {
      console.error(`❌ Email sending failed: ${emailResult.error}`);
      // Still return success since OTP was saved to database
      // User can try again or contact support
    }

    return response;
  }
}

module.exports = new OtpService();