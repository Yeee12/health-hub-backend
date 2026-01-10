const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: {
      values: ['patient', 'doctor', 'admin'],
      message: 'Role must be either patient, doctor, or admin'
    },
    required: [true, 'Role is required']
  },
  profilePicture: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  refreshTokens: [{
    type: String
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verificationToken: String,
  verificationExpires: Date,

    otp: {
    type: String,
    select: false
  },
  otpCreatedAt: {
    type: Date,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// INDEXES
// Note: email and phoneNumber already have indexes from 'unique: true'
userSchema.index({ role: 1 });

// MIDDLEWARE: Hash password before saving
userSchema.pre('save', async function() {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// METHOD: Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// METHOD: Generate JWT Access Token
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      email: this.email,
      role: this.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// METHOD: Generate JWT Refresh Token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

// METHOD: Add refresh token to user
userSchema.methods.addRefreshToken = async function(token) {
  this.refreshTokens.push(token);
  await this.save();
};

// METHOD: Remove refresh token (logout)
userSchema.methods.removeRefreshToken = async function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t !== token);
  await this.save();
};

// METHOD: Update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// VIRTUAL: Get role-specific profile
userSchema.virtual('profile', {
  ref: function() {
    if (this.role === 'patient') return 'Patient';
    if (this.role === 'doctor') return 'Doctor';
    return null;
  },
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);