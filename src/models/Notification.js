const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: {
      values: [
        'appointment_confirmed',
        'appointment_reminder',
        'appointment_cancelled',
        'appointment_rescheduled',
        'payment_success',
        'payment_failed',
        'refund_processed',
        'review_received',
        'review_response',
        'new_message',
        'doctor_verified',
        'doctor_rejected',
        'consultation_ready',
        'follow_up_reminder',
        'payout_completed',
        'system_announcement'
      ],
      message: 'Invalid notification type'
    },
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    // Could reference Appointment, Payment, Review, etc.
  },
  relatedModel: {
    type: String,
    enum: ['Appointment', 'Payment', 'Review', 'Consultation', 'Message', null]
  },
  channels: [{
    type: String,
    enum: {
      values: ['push', 'email', 'sms', 'in-app'],
      message: 'Invalid notification channel'
    }
  }],
  pushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: {
    type: Date
  },
  pushError: {
    type: String
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  },
  emailError: {
    type: String
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  smsSentAt: {
    type: Date
  },
  smsError: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  actionUrl: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Invalid priority level'
    },
    default: 'medium'
  },
  expiresAt: {
    type: Date // For time-sensitive notifications
  }
}, {
  timestamps: true
});

// INDEXES
notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 }); // Compound for unread notifications
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// VIRTUAL: Is unread
notificationSchema.virtual('isUnread').get(function() {
  return !this.isRead;
});

// VIRTUAL: All channels sent successfully
notificationSchema.virtual('allChannelsSent').get(function() {
  return this.channels.every(channel => {
    if (channel === 'push') return this.pushSent;
    if (channel === 'email') return this.emailSent;
    if (channel === 'sms') return this.smsSent;
    if (channel === 'in-app') return true; // In-app is instant
    return false;
  });
});

// VIRTUAL: Has delivery errors
notificationSchema.virtual('hasErrors').get(function() {
  return !!(this.pushError || this.emailError || this.smsError);
});

// VIRTUAL: Time since created (in minutes)
notificationSchema.virtual('minutesSinceCreated').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60));
});

// VIRTUAL: Is expired
notificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// METHOD: Mark as read
notificationSchema.methods.markRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

// METHOD: Mark push notification as sent
notificationSchema.methods.markPushSent = async function(error = null) {
  this.pushSent = !error;
  this.pushSentAt = new Date();
  if (error) {
    this.pushError = error;
  }
  await this.save();
};

// METHOD: Mark email as sent
notificationSchema.methods.markEmailSent = async function(error = null) {
  this.emailSent = !error;
  this.emailSentAt = new Date();
  if (error) {
    this.emailError = error;
  }
  await this.save();
};

// METHOD: Mark SMS as sent
notificationSchema.methods.markSmsSent = async function(error = null) {
  this.smsSent = !error;
  this.smsSentAt = new Date();
  if (error) {
    this.smsError = error;
  }
  await this.save();
};

// STATIC: Get unread notifications for user
notificationSchema.statics.getUnread = async function(userId, limit = 20) {
  return await this.find({
    userId,
    isRead: false
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// STATIC: Get unread count for user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    userId,
    isRead: false
  });
};

// STATIC: Mark all as read for user
notificationSchema.statics.markAllRead = async function(userId) {
  return await this.updateMany(
    { userId, isRead: false },
    { 
      $set: { 
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// STATIC: Get notifications by type
notificationSchema.statics.getByType = async function(userId, type, limit = 10) {
  return await this.find({
    userId,
    type
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// STATIC: Get recent notifications
notificationSchema.statics.getRecent = async function(userId, limit = 20) {
  return await this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// STATIC: Create and send notification
notificationSchema.statics.createAndSend = async function(notificationData) {
  const notification = await this.create(notificationData);
  
  // Here you would trigger actual sending via different channels
  // This is just a placeholder - actual implementation would use services like:
  // - Firebase Cloud Messaging for push
  // - SendGrid/Nodemailer for email
  // - Twilio for SMS
  
  return notification;
};

// STATIC: Create appointment reminder
notificationSchema.statics.createAppointmentReminder = async function(appointment) {
  const Patient = mongoose.model('Patient');
  const Doctor = mongoose.model('Doctor');
  
  const patient = await Patient.findById(appointment.patientId).populate('userId');
  const doctor = await Doctor.findById(appointment.doctorId);
  
  const appointmentTime = new Date(appointment.appointmentDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return await this.create({
    userId: patient.userId._id,
    type: 'appointment_reminder',
    title: 'Upcoming Appointment Reminder',
    message: `You have an appointment with Dr. ${doctor.firstName} ${doctor.lastName} at ${appointmentTime}`,
    relatedId: appointment._id,
    relatedModel: 'Appointment',
    channels: ['push', 'email', 'in-app'],
    actionUrl: `/appointments/${appointment._id}`,
    priority: 'high'
  });
};

// STATIC: Delete old read notifications (cleanup)
notificationSchema.statics.deleteOldRead = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate }
  });
};

// STATIC: Get failed notifications for retry
notificationSchema.statics.getFailedForRetry = async function() {
  return await this.find({
    $or: [
      { channels: 'push', pushSent: false, pushError: { $exists: true } },
      { channels: 'email', emailSent: false, emailError: { $exists: true } },
      { channels: 'sms', smsSent: false, smsError: { $exists: true } }
    ],
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours only
  });
};

// Ensure virtuals are included in JSON
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);