const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required'],
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor ID is required']
  },
  chiefComplaint: {
    type: String,
    trim: true,
    maxlength: [500, 'Chief complaint cannot exceed 500 characters']
  },
  historyOfPresentIllness: {
    type: String,
    trim: true,
    maxlength: [2000, 'History cannot exceed 2000 characters']
  },
  physicalExamination: {
    type: String,
    trim: true,
    maxlength: [2000, 'Physical examination notes cannot exceed 2000 characters']
  },
  vitals: {
    bloodPressure: {
      type: String,
      trim: true,
      validate: {
        validator: function(value) {
          if (!value) return true; // Optional
          // Format: systolic/diastolic (e.g., "120/80")
          return /^\d{2,3}\/\d{2,3}$/.test(value);
        },
        message: 'Blood pressure must be in format: systolic/diastolic (e.g., 120/80)'
      }
    },
    heartRate: {
      type: Number,
      min: [30, 'Heart rate seems too low'],
      max: [250, 'Heart rate seems too high']
    },
    temperature: {
      type: Number,
      min: [35, 'Temperature seems too low'],
      max: [43, 'Temperature seems too high']
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative']
    },
    height: {
      type: Number,
      min: [0, 'Height cannot be negative']
    },
    oxygenSaturation: {
      type: Number,
      min: [0, 'Oxygen saturation cannot be below 0%'],
      max: [100, 'Oxygen saturation cannot exceed 100%']
    }
  },
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true,
    maxlength: [1000, 'Diagnosis cannot exceed 1000 characters']
  },
  differentialDiagnosis: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each differential diagnosis cannot exceed 500 characters']
  }],
  prescription: [
    {
      medication: {
        type: String,
        required: [true, 'Medication name is required'],
        trim: true
      },
      dosage: {
        type: String,
        required: [true, 'Dosage is required'],
        trim: true
      },
      frequency: {
        type: String,
        required: [true, 'Frequency is required'],
        trim: true
      },
      duration: {
        type: String,
        required: [true, 'Duration is required'],
        trim: true
      },
      instructions: {
        type: String,
        trim: true,
        maxlength: [500, 'Instructions cannot exceed 500 characters']
      }
    }
  ],
  recommendedTests: [
    {
      testName: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true
      },
      reason: {
        type: String,
        trim: true,
        maxlength: [500, 'Reason cannot exceed 500 characters']
      },
      urgent: {
        type: Boolean,
        default: false
      }
    }
  ],
  attachments: [
    {
      fileName: {
        type: String,
        required: true,
        trim: true
      },
      fileUrl: {
        type: String,
        required: true
      },
      fileType: {
        type: String,
        enum: {
          values: ['prescription', 'lab-result', 'xray', 'scan', 'report', 'other'],
          message: 'Invalid file type'
        },
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional
        return value > new Date();
      },
      message: 'Follow-up date must be in the future'
    }
  },
  followUpNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Follow-up notes cannot exceed 1000 characters']
  },
  privateNotes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Private notes cannot exceed 2000 characters']
  }
}, {
  timestamps: true
});

// INDEXES
// Note: appointmentId already has an index from 'unique: true'
consultationSchema.index({ patientId: 1 });
consultationSchema.index({ doctorId: 1 });
consultationSchema.index({ createdAt: -1 }); // For recent records

// VIRTUAL: Calculate BMI if weight and height are available
consultationSchema.virtual('bmi').get(function() {
  if (!this.vitals || !this.vitals.weight || !this.vitals.height) {
    return null;
  }
  
  // BMI = weight (kg) / (height (m))^2
  const heightInMeters = this.vitals.height / 100;
  const bmi = this.vitals.weight / (heightInMeters * heightInMeters);
  
  return Math.round(bmi * 10) / 10; // Round to 1 decimal
});

// VIRTUAL: BMI Category
consultationSchema.virtual('bmiCategory').get(function() {
  const bmi = this.bmi;
  if (!bmi) return null;
  
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
});

// VIRTUAL: Has prescriptions
consultationSchema.virtual('hasPrescriptions').get(function() {
  return this.prescription && this.prescription.length > 0;
});

// VIRTUAL: Has tests ordered
consultationSchema.virtual('hasTestsOrdered').get(function() {
  return this.recommendedTests && this.recommendedTests.length > 0;
});

// METHOD: Add prescription
consultationSchema.methods.addPrescription = async function(medicationData) {
  this.prescription.push(medicationData);
  await this.save();
};

// METHOD: Add recommended test
consultationSchema.methods.addRecommendedTest = async function(testData) {
  this.recommendedTests.push(testData);
  await this.save();
};

// METHOD: Upload attachment
consultationSchema.methods.uploadAttachment = async function(attachmentData) {
  this.attachments.push(attachmentData);
  await this.save();
};

// METHOD: Set follow-up
consultationSchema.methods.scheduleFollowUp = async function(date, notes) {
  this.followUpRequired = true;
  this.followUpDate = date;
  this.followUpNotes = notes;
  await this.save();
};

// STATIC: Get patient's medical history
consultationSchema.statics.getPatientHistory = async function(patientId, limit = 10) {
  return await this.find({ patientId })
    .populate('doctorId', 'firstName lastName specialties')
    .populate('appointmentId', 'appointmentDate consultationType')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-privateNotes'); // Exclude doctor's private notes
};

// STATIC: Get consultations by doctor
consultationSchema.statics.getByDoctor = async function(doctorId, limit = 10) {
  return await this.find({ doctorId })
    .populate('patientId', 'firstName lastName dateOfBirth')
    .populate('appointmentId', 'appointmentDate consultationType')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// STATIC: Search consultations by diagnosis
consultationSchema.statics.searchByDiagnosis = async function(diagnosisKeyword, doctorId = null) {
  const query = {
    diagnosis: { $regex: diagnosisKeyword, $options: 'i' }
  };
  
  if (doctorId) {
    query.doctorId = doctorId;
  }
  
  return await this.find(query)
    .populate('patientId', 'firstName lastName')
    .populate('appointmentId', 'appointmentDate')
    .sort({ createdAt: -1 });
};

// MIDDLEWARE: Prevent modification after 24 hours
consultationSchema.pre('save', function() {
  if (!this.isNew) {
    const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    
    if (hoursSinceCreation > 24) {
      // Allow only adding attachments after 24 hours
      const modifiedPaths = this.modifiedPaths();
      const allowedModifications = ['attachments', 'updatedAt'];
      
      const hasUnauthorizedChanges = modifiedPaths.some(
        path => !allowedModifications.some(allowed => path.startsWith(allowed))
      );
      
      if (hasUnauthorizedChanges) {
        throw new Error('Consultation records cannot be modified after 24 hours');
      }
    }
  }
});

// Ensure virtuals are included in JSON
consultationSchema.set('toJSON', { virtuals: true });
consultationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Consultation', consultationSchema);