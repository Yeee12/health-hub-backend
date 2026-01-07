const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
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
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        // Must be in the past
        return value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Gender must be male, female, or other'
    }
  },
  bloodGroup: {
    type: String,
    enum: {
      values: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
      message: 'Invalid blood group'
    }
  },
  address: {
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
  medicalHistory: [{
    condition: {
      type: String,
      required: true,
      trim: true
    },
    diagnosedDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  allergies: [{
    type: String,
    trim: true
  }],
  currentMedications: [{
    type: String,
    trim: true
  }],
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(value) {
          if (!value) return true; // Optional field
          return /^\+?[\d\s\-()]+$/.test(value);
        },
        message: 'Invalid phone number format'
      }
    }
  },
  totalAppointments: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// INDEXES
// Note: userId already has an index from 'unique: true'
patientSchema.index({ 'address.coordinates': '2dsphere' }); // For geolocation queries

// VIRTUAL: Full Name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// VIRTUAL: Age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// METHOD: Increment appointment count
patientSchema.methods.incrementAppointmentCount = async function() {
  this.totalAppointments += 1;
  await this.save();
};

// METHOD: Add medical history entry
patientSchema.methods.addMedicalHistory = async function(historyEntry) {
  this.medicalHistory.push(historyEntry);
  await this.save();
};

// METHOD: Update emergency contact
patientSchema.methods.updateEmergencyContact = async function(contactInfo) {
  this.emergencyContact = { ...this.emergencyContact, ...contactInfo };
  await this.save();
};

// Ensure virtuals are included in JSON
patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Patient', patientSchema);