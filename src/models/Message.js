const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required']
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required']
  },
  messageType: {
    type: String,
    enum: {
      values: ['text', 'image', 'file', 'audio', 'system'],
      message: 'Invalid message type'
    },
    default: 'text'
  },
  content: {
    type: String,
    trim: true,
    maxlength: [2000, 'Message content cannot exceed 2000 characters']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
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
        required: true,
        trim: true
      },
      fileSize: {
        type: Number, // in bytes
        min: [0, 'File size cannot be negative']
      },
      thumbnail: {
        type: String // For images/videos
      }
    }
  ],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message' // For threaded conversations
  }
}, {
  timestamps: true
});

// INDEXES
messageSchema.index({ appointmentId: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });
messageSchema.index({ createdAt: 1 }); // For chronological order
messageSchema.index({ appointmentId: 1, createdAt: 1 }); // Compound for conversation retrieval
messageSchema.index({ receiverId: 1, isRead: 1 }); // For unread messages
messageSchema.index({ isDeleted: 1 });

// VIRTUAL: Is unread
messageSchema.virtual('isUnread').get(function() {
  return !this.isRead;
});

// VIRTUAL: Has attachments
messageSchema.virtual('hasAttachments').get(function() {
  return this.attachments && this.attachments.length > 0;
});

// VIRTUAL: Is system message
messageSchema.virtual('isSystemMessage').get(function() {
  return this.messageType === 'system';
});

// VIRTUAL: Time since sent (in minutes)
messageSchema.virtual('minutesSinceSent').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60));
});

// VIRTUAL: Can be edited (within 15 minutes)
messageSchema.virtual('canEdit').get(function() {
  if (this.isDeleted || this.messageType !== 'text') return false;
  return this.minutesSinceSent <= 15;
});

// VIRTUAL: Can be deleted (within 1 hour)
messageSchema.virtual('canDelete').get(function() {
  if (this.isDeleted) return false;
  return this.minutesSinceSent <= 60;
});

// METHOD: Mark as read
messageSchema.methods.markRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

// METHOD: Mark as delivered
messageSchema.methods.markDelivered = async function() {
  if (!this.deliveredAt) {
    this.deliveredAt = new Date();
    await this.save();
  }
};

// METHOD: Edit message
messageSchema.methods.editContent = async function(newContent) {
  if (!this.canEdit) {
    throw new Error('Message can only be edited within 15 minutes of sending');
  }
  
  if (this.messageType !== 'text') {
    throw new Error('Only text messages can be edited');
  }
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

// METHOD: Delete message
messageSchema.methods.delete = async function(userId) {
  if (!this.canDelete) {
    throw new Error('Message can only be deleted within 1 hour of sending');
  }
  
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.content = 'This message was deleted';
  await this.save();
};

// STATIC: Get conversation messages
messageSchema.statics.getConversation = async function(appointmentId, options = {}) {
  const {
    page = 1,
    limit = 50,
    before = null, // Get messages before this message ID (for pagination)
    after = null   // Get messages after this message ID (for new messages)
  } = options;
  
  const query = { appointmentId, isDeleted: false };
  
  if (before) {
    const beforeMessage = await this.findById(before);
    if (beforeMessage) {
      query.createdAt = { $lt: beforeMessage.createdAt };
    }
  }
  
  if (after) {
    const afterMessage = await this.findById(after);
    if (afterMessage) {
      query.createdAt = { $gt: afterMessage.createdAt };
    }
  }
  
  const messages = await this.find(query)
    .populate('senderId', 'email role profilePicture')
    .populate('receiverId', 'email role profilePicture')
    .populate('replyTo', 'content messageType senderId')
    .sort({ createdAt: after ? 1 : -1 }) // Ascending for new messages, descending for history
    .limit(limit);
  
  // Reverse if getting history (so oldest is first)
  if (!after) {
    messages.reverse();
  }
  
  return messages;
};

// STATIC: Get unread count for user
messageSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    receiverId: userId,
    isRead: false,
    isDeleted: false
  });
};

// STATIC: Get unread messages for appointment
messageSchema.statics.getUnreadForAppointment = async function(appointmentId, userId) {
  return await this.find({
    appointmentId,
    receiverId: userId,
    isRead: false,
    isDeleted: false
  })
  .populate('senderId', 'email role profilePicture')
  .sort({ createdAt: 1 });
};

// STATIC: Mark all as read for conversation
messageSchema.statics.markAllReadInConversation = async function(appointmentId, userId) {
  return await this.updateMany(
    {
      appointmentId,
      receiverId: userId,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// STATIC: Get latest message for appointment
messageSchema.statics.getLatestForAppointment = async function(appointmentId) {
  return await this.findOne({
    appointmentId,
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .populate('senderId', 'email role profilePicture');
};

// STATIC: Get conversation summary (for chat list)
messageSchema.statics.getConversationSummaries = async function(userId, userRole) {
  // Get all appointments where user is either patient or doctor
  const Appointment = mongoose.model('Appointment');
  const query = userRole === 'doctor' 
    ? { doctorId: userId }
    : { patientId: userId };
  
  const appointments = await Appointment.find(query)
    .populate('patientId', 'firstName lastName profilePicture')
    .populate('doctorId', 'firstName lastName profilePicture')
    .sort({ appointmentDate: -1 });
  
  const summaries = await Promise.all(
    appointments.map(async (appointment) => {
      const latestMessage = await this.getLatestForAppointment(appointment._id);
      const unreadCount = await this.countDocuments({
        appointmentId: appointment._id,
        receiverId: userId,
        isRead: false,
        isDeleted: false
      });
      
      return {
        appointment,
        latestMessage,
        unreadCount
      };
    })
  );
  
  // Filter out conversations with no messages and sort by latest message
  return summaries
    .filter(s => s.latestMessage)
    .sort((a, b) => {
      const aTime = a.latestMessage ? a.latestMessage.createdAt : 0;
      const bTime = b.latestMessage ? b.latestMessage.createdAt : 0;
      return bTime - aTime;
    });
};

// STATIC: Create system message
messageSchema.statics.createSystemMessage = async function(appointmentId, content) {
  const Appointment = mongoose.model('Appointment');
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }
  
  return await this.create({
    appointmentId,
    senderId: appointment.doctorId, // System messages are from doctor's side
    receiverId: appointment.patientId,
    messageType: 'system',
    content,
    isRead: false
  });
};

// STATIC: Search messages in conversation
messageSchema.statics.searchInConversation = async function(appointmentId, searchTerm) {
  return await this.find({
    appointmentId,
    messageType: 'text',
    isDeleted: false,
    content: { $regex: searchTerm, $options: 'i' }
  })
  .populate('senderId', 'email role profilePicture')
  .sort({ createdAt: -1 })
  .limit(20);
};

// STATIC: Get message statistics for appointment
messageSchema.statics.getStats = async function(appointmentId) {
  const stats = await this.aggregate([
    {
      $match: {
        appointmentId: new mongoose.Types.ObjectId(appointmentId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$senderId',
        messageCount: { $sum: 1 },
        textMessages: {
          $sum: { $cond: [{ $eq: ['$messageType', 'text'] }, 1, 0] }
        },
        attachmentMessages: {
          $sum: { $cond: [{ $ne: ['$messageType', 'text'] }, 1, 0] }
        }
      }
    }
  ]);
  
  const totalMessages = await this.countDocuments({
    appointmentId,
    isDeleted: false
  });
  
  return {
    totalMessages,
    byUser: stats
  };
};

// STATIC: Delete old messages (cleanup - optional)
messageSchema.statics.deleteOldMessages = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // Only delete messages from completed appointments
  const Appointment = mongoose.model('Appointment');
  const oldAppointments = await Appointment.find({
    status: 'completed',
    completedAt: { $lt: cutoffDate }
  }).select('_id');
  
  const appointmentIds = oldAppointments.map(a => a._id);
  
  return await this.deleteMany({
    appointmentId: { $in: appointmentIds }
  });
};

// MIDDLEWARE: Validate sender and receiver are part of the appointment
messageSchema.pre('save', async function() {
  if (this.isNew && this.messageType !== 'system') {
    const Appointment = mongoose.model('Appointment');
    const appointment = await Appointment.findById(this.appointmentId)
      .populate('patientId', 'userId')
      .populate('doctorId', 'userId');
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    const patientUserId = appointment.patientId.userId.toString();
    const doctorUserId = appointment.doctorId.userId.toString();
    const senderIdStr = this.senderId.toString();
    const receiverIdStr = this.receiverId.toString();
    
    const isValidParticipant = 
      (senderIdStr === patientUserId || senderIdStr === doctorUserId) &&
      (receiverIdStr === patientUserId || receiverIdStr === doctorUserId) &&
      senderIdStr !== receiverIdStr;
    
    if (!isValidParticipant) {
      throw new Error('Sender and receiver must be participants of the appointment');
    }
  }
});

// MIDDLEWARE: Validate content based on message type
messageSchema.pre('save', function() {
  if (this.messageType === 'text' && !this.content) {
    throw new Error('Text messages must have content');
  }
  
  if (['image', 'file', 'audio'].includes(this.messageType) && 
      (!this.attachments || this.attachments.length === 0)) {
    throw new Error(`${this.messageType} messages must have attachments`);
  }
});

// Ensure virtuals are included in JSON
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);