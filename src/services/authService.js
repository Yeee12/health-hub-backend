const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const crypto = require('crypto');
const { sendOtpEmail } = require('../utils/emailService');

// Generate 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

class AuthService {
  async registerUser(data) {
    const { email, password, phoneNumber, role, firstName, lastName, specialties, licenseNumber } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    // Check if phone number exists
    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        const error = new Error('User with this phone number already exists');
        error.statusCode = 400;
        throw error;
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
      otpAttempts: 0, // Initialize attempts counter
    });

    // Create role-specific profile
    if (role === 'patient') {
      await Patient.create({
        userId: user._id,
        firstName,
        lastName,
      });
    } else if (role === 'doctor') {
      if (!specialties || !licenseNumber) {
        await User.findByIdAndDelete(user._id);
        const error = new Error('Specialties and license number are required for doctors');
        error.statusCode = 400;
        throw error;
      }

      const doctor = await Doctor.create({
        userId: user._id,
        firstName,
        lastName,
        specialties: Array.isArray(specialties) ? specialties : [specialties],
        licenseNumber,
      });

      await Availability.createDefault(doctor._id);
    }

    console.log(`🔐 Generated OTP for ${email}: ${otp}`);
    console.log('📧 Queuing OTP email to:', email);

 // ✅ NEW CODE (Correct - proper boolean handling)
sendOtpEmail(email, otp, firstName)
  .then((success) => {
    if (success) {  // Correct! sendOtpEmail returns boolean
      console.log('✅ OTP email sent to:', email);
    } else {
      console.warn('⚠️ OTP email failed (non-critical)');
    }
  })
  .catch((error) => {
    console.error('❌ OTP email error:', error.message);
  });

    // Build response - return immediately without waiting for email
    const response = {
      success: true,
      message: 'Registration successful. Please check your email for OTP verification.',
      data: {
        userId: user._id,
        email: user.email,
        role: user.role,
        emailSent: true, // Always true since we're queuing it
      },
    };

    // Include OTP in development mode for easy testing
    if (process.env.NODE_ENV !== 'production') {
      response.data.otp = otp;
      console.log('⚠️ DEV MODE: OTP included in response:', otp);
    }

    return response;
  }

  async loginUser(data) {
    const { email, password } = data;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Check if email is verified
    if (!user.emailVerified) {
      const error = new Error('Please verify your email before logging in');
      error.statusCode = 403;
      error.userId = user._id;
      error.email = user.email;
      error.requiresVerification = true;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error('Your account has been deactivated');
      error.statusCode = 401;
      throw error;
    }

    if (user.isSuspended) {
      const error = new Error('Your account has been suspended');
      error.statusCode = 401;
      throw error;
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
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          profile,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    };
  }

  async logoutUser(user, refreshToken) {
    if (refreshToken) {
      await user.removeRefreshToken(refreshToken);
    }
  }

  async getCurrentUser(user) {
    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await Doctor.findOne({ userId: user._id });
    }

    return {
      success: true,
      data: {
        user,
        profile,
      },
    };
  }

  async forgotPassword(email) {
    if (!email) {
      const error = new Error('Please provide email address');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error('No user found with this email');
      error.statusCode = 404;
      throw error;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    return {
      success: true,
      message: 'Password reset token generated',
      data: {
        resetToken,
        message: 'Password reset link has been sent to your email',
      },
    };
  }

  async resetPassword(data) {
    const { resetToken, newPassword } = data;

    if (!resetToken || !newPassword) {
      const error = new Error('Please provide reset token and new password');
      error.statusCode = 400;
      throw error;
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      const error = new Error('Invalid or expired reset token');
      error.statusCode = 400;
      throw error;
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];

    await user.save();

    return {
      success: true,
      message: 'Password reset successful. Please login with your new password',
    };
  }
}

module.exports = new AuthService();