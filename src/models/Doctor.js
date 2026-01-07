const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters']
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Gender must be male, female, or other'
    }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        return value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  specialties: [{
    type: String,
    required: [true, 'At least one specialty is required'],
    trim: true
  }],
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  yearsOfExperience: {
    type: Number,
    min: [0, 'Years of experience cannot be negative'],
    default: 0
  },
  qualifications: [{
    type: String,
    trim: true
  }],
  verificationStatus: {
    type: String,
    enum: {
      values: ['pending', 'verified', 'rejected'],
      message: 'Verification status must be pending, verified, or rejected'
    },
    default: 'pending'
  },
  verificationDocuments: [{
    documentType: {
      type: String,
      enum: ['license', 'degree', 'certificate', 'other'],
      required: true
    },
    documentUrl: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  hospitalAffiliations: [{
    type: String,
    trim: true
  }],
  clinicAddress: {
    name: {
      type: String,
      trim: true
    },
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'Nigeria'
    },
    zipCode: {
      type: String,
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    }
  },
  consultationFee: {
    inPerson: {
      type: Number,
      default: 0,
      min: [0, 'Consultation fee cannot be negative']
    },
    video: {
      type: Number,
      default: 0,
      min: [0, 'Consultation fee cannot be negative']
    },
    chat: {
      type: Number,
      default: 0,
      min: [0, 'Consultation fee cannot be negative']
    }
  },
  consultationTypes: [{
    type: String,
    enum: {
      values: ['in-person', 'video', 'chat'],
      message: 'Invalid consultation type'
    }
  }],
  about: {
    type: String,
    trim: true,
    maxlength: [1000, 'About section cannot exceed 1000 characters']
  },
  languages: [{
    type: String,
    trim: true
  }],
  totalAppointments: {
    type: Number,
    default: 0,
    min: 0
  },
  completedAppointments: {
    type: Number,
    default: 0,
    min: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: val => Math.round(val * 10) / 10 // Round to 1 decimal
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  bankDetails: {
    accountName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    bankCode: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true
});

// INDEXES
// Note: userId and licenseNumber already have indexes from 'unique: true'
doctorSchema.index({ specialties: 1 });
doctorSchema.index({ verificationStatus: 1 });
doctorSchema.index({ averageRating: -1 }); // Descending for top-rated
doctorSchema.index({ 'clinicAddress.coordinates': '2dsphere' });
doctorSchema.index({ verificationStatus: 1, specialties: 1, averageRating: -1 }); // Compound

// VIRTUAL: Full Name
doctorSchema.virtual('fullName').get(function() {
  return `Dr. ${this.firstName} ${this.lastName}`;
});

// VIRTUAL: Completion Rate
doctorSchema.virtual('completionRate').get(function() {
  if (this.totalAppointments === 0) return 0;
  return Math.round((this.completedAppointments / this.totalAppointments) * 100);
});

// METHOD: Update rating
doctorSchema.methods.updateRating = async function(newRating) {
  const totalRatingPoints = this.averageRating * this.totalReviews;
  this.totalReviews += 1;
  this.averageRating = (totalRatingPoints + newRating) / this.totalReviews;
  await this.save();
};

// METHOD: Verify doctor
doctorSchema.methods.verify = async function(adminId) {
  this.verificationStatus = 'verified';
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.rejectionReason = undefined;
  await this.save();
};

// METHOD: Reject doctor
doctorSchema.methods.reject = async function(reason) {
  this.verificationStatus = 'rejected';
  this.rejectionReason = reason;
  this.verifiedAt = undefined;
  this.verifiedBy = undefined;
  await this.save();
};

// METHOD: Increment appointment count
doctorSchema.methods.incrementAppointmentCount = async function() {
  this.totalAppointments += 1;
  await this.save();
};

// METHOD: Increment completed appointments
doctorSchema.methods.incrementCompletedCount = async function() {
  this.completedAppointments += 1;
  await this.save();
};

// METHOD: Add earnings
doctorSchema.methods.addEarnings = async function(amount) {
  this.totalEarnings += amount;
  await this.save();
};

// Ensure virtuals are included in JSON
doctorSchema.set('toJSON', { virtuals: true });
doctorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Doctor', doctorSchema);