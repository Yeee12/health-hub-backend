const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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
  appointmentDate: {
    type: Date,
    required: [true, 'Appointment date is required'],
    validate: {
      validator: function(value) {
        // Appointment must be in the future (at booking time)
        if (this.isNew) {
          return value > new Date();
        }
        return true;
      },
      message: 'Appointment date must be in the future'
    }
  },
  duration: {
    type: Number,
    default: 30,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [120, 'Duration cannot exceed 120 minutes']
  },
  consultationType: {
    type: String,
    enum: {
      values: ['in-person', 'video', 'chat'],
      message: 'Consultation type must be in-person, video, or chat'
    },
    required: [true, 'Consultation type is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
      message: 'Invalid appointment status'
    },
    default: 'pending'
  },
  reasonForVisit: {
    type: String,
    required: [true, 'Reason for visit is required'],
    trim: true,
    minlength: [10, 'Reason must be at least 10 characters'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  symptoms: [{
    type: String,
    trim: true
  }],
  attachments: [{
    type: String // URLs to uploaded files
  }],
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  completedAt: {
    type: Date
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  consultationFee: {
    type: Number,
    required: [true, 'Consultation fee is required'],
    min: [0, 'Fee cannot be negative']
  },
  videoCallToken: {
    type: String
  },
  callStartedAt: {
    type: Date
  },
  callEndedAt: {
    type: Date
  },
  callDuration: {
    type: Number, // in seconds
    default: 0
  },
  callRecordingUrl: {
    type: String
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  isFollowUp: {
    type: Boolean,
    default: false
  },
  previousAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }
}, {
  timestamps: true
});

// INDEXES
appointmentSchema.index({ patientId: 1 });
appointmentSchema.index({ doctorId: 1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, status: 1 }); // Critical for conflict checking
appointmentSchema.index({ patientId: 1, status: 1 });

// VIRTUAL: Is appointment today
appointmentSchema.virtual('isToday').get(function() {
  const today = new Date();
  const appointmentDate = new Date(this.appointmentDate);
  
  return (
    today.getDate() === appointmentDate.getDate() &&
    today.getMonth() === appointmentDate.getMonth() &&
    today.getFullYear() === appointmentDate.getFullYear()
  );
});

// VIRTUAL: Is appointment upcoming
appointmentSchema.virtual('isUpcoming').get(function() {
  return this.appointmentDate > new Date() && ['pending', 'confirmed'].includes(this.status);
});

// VIRTUAL: Is appointment past
appointmentSchema.virtual('isPast').get(function() {
  return this.appointmentDate < new Date();
});

// VIRTUAL: Time until appointment (in hours)
appointmentSchema.virtual('hoursUntilAppointment').get(function() {
  const now = new Date();
  const diff = this.appointmentDate - now;
  return Math.floor(diff / (1000 * 60 * 60));
});

// METHOD: Confirm appointment
appointmentSchema.methods.confirm = async function(userId) {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  this.confirmedBy = userId;
  await this.save();
};

// METHOD: Cancel appointment
appointmentSchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  await this.save();
};

// METHOD: Mark as in-progress
appointmentSchema.methods.startConsultation = async function() {
  this.status = 'in-progress';
  if (this.consultationType === 'video') {
    this.callStartedAt = new Date();
  }
  await this.save();
};

// METHOD: Complete appointment
appointmentSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (this.consultationType === 'video' && this.callStartedAt) {
    this.callEndedAt = new Date();
    this.callDuration = Math.floor((this.callEndedAt - this.callStartedAt) / 1000);
  }
  
  await this.save();
};

// METHOD: Mark as no-show
appointmentSchema.methods.markNoShow = async function() {
  this.status = 'no-show';
  await this.save();
};

// METHOD: Send reminder
appointmentSchema.methods.markReminderSent = async function() {
  this.reminderSent = true;
  this.reminderSentAt = new Date();
  await this.save();
};

// METHOD: Check if can be cancelled (e.g., at least 24 hours before)
appointmentSchema.methods.canBeCancelled = function(hoursBeforeLimit = 24) {
  const hoursUntil = this.hoursUntilAppointment;
  return hoursUntil >= hoursBeforeLimit && ['pending', 'confirmed'].includes(this.status);
};

// STATIC: Check for appointment conflicts
appointmentSchema.statics.hasConflict = async function(doctorId, appointmentDate, duration, excludeId = null) {
  const startTime = new Date(appointmentDate);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const query = {
    doctorId,
    status: { $in: ['pending', 'confirmed', 'in-progress'] },
    $or: [
      // New appointment starts during existing appointment
      {
        appointmentDate: { $lte: startTime },
        $expr: {
          $gte: [
            { $add: ['$appointmentDate', { $multiply: ['$duration', 60000] }] },
            startTime
          ]
        }
      },
      // New appointment ends during existing appointment
      {
        appointmentDate: { $lt: endTime },
        $expr: {
          $gt: [
            { $add: ['$appointmentDate', { $multiply: ['$duration', 60000] }] },
            startTime
          ]
        }
      },
      // Existing appointment is completely within new appointment
      {
        appointmentDate: { $gte: startTime, $lt: endTime }
      }
    ]
  };

  // Exclude current appointment if updating
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflicts = await this.find(query);
  return conflicts.length > 0;
};

// STATIC: Get upcoming appointments for doctor
appointmentSchema.statics.getUpcomingForDoctor = async function(doctorId, limit = 10) {
  return await this.find({
    doctorId,
    status: { $in: ['pending', 'confirmed'] },
    appointmentDate: { $gte: new Date() }
  })
  .populate('patientId', 'firstName lastName profilePicture')
  .sort({ appointmentDate: 1 })
  .limit(limit);
};

// STATIC: Get upcoming appointments for patient
appointmentSchema.statics.getUpcomingForPatient = async function(patientId, limit = 10) {
  return await this.find({
    patientId,
    status: { $in: ['pending', 'confirmed'] },
    appointmentDate: { $gte: new Date() }
  })
  .populate('doctorId', 'firstName lastName specialties profilePicture')
  .sort({ appointmentDate: 1 })
  .limit(limit);
};

// STATIC: Get appointments needing reminders (30 minutes before)
appointmentSchema.statics.getNeedingReminders = async function() {
  const now = new Date();
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60000);

  return await this.find({
    status: { $in: ['pending', 'confirmed'] },
    reminderSent: false,
    appointmentDate: {
      $gte: now,
      $lte: thirtyMinutesFromNow
    }
  })
  .populate('patientId', 'firstName lastName email phoneNumber')
  .populate('doctorId', 'firstName lastName specialties');
};

// Ensure virtuals are included in JSON
appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Appointment', appointmentSchema);