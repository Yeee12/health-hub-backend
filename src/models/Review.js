const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor ID is required']
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required'],
    unique: true // One review per appointment
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: function(value) {
        // Only whole numbers (1, 2, 3, 4, 5)
        return Number.isInteger(value);
      },
      message: 'Rating must be a whole number'
    }
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    enum: {
      values: [
        'Professional',
        'Friendly',
        'Knowledgeable',
        'Good Listener',
        'Punctual',
        'Thorough',
        'Compassionate',
        'Clear Communicator',
        'Respectful',
        'Patient'
      ],
      message: 'Invalid tag'
    }
  }],
  helpfulCount: {
    type: Number,
    default: 0,
    min: [0, 'Helpful count cannot be negative']
  },
  markedHelpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  doctorResponse: {
    type: String,
    trim: true,
    maxlength: [500, 'Doctor response cannot exceed 500 characters']
  },
  respondedAt: {
    type: Date
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  hiddenReason: {
    type: String,
    enum: ['spam', 'offensive', 'inappropriate', 'false_information', 'other'],
    trim: true
  },
  hiddenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who hid it
  },
  hiddenAt: {
    type: Date
  }
}, {
  timestamps: true
});

// INDEXES
// Note: appointmentId already has an index from 'unique: true'
reviewSchema.index({ doctorId: 1 });
reviewSchema.index({ patientId: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ doctorId: 1, createdAt: -1 }); // Compound for doctor's reviews
reviewSchema.index({ doctorId: 1, isHidden: 1 }); // For filtering visible reviews

// VIRTUAL: Is positive review (4-5 stars)
reviewSchema.virtual('isPositive').get(function() {
  return this.rating >= 4;
});

// VIRTUAL: Has doctor responded
reviewSchema.virtual('hasResponse').get(function() {
  return !!this.doctorResponse;
});

// VIRTUAL: Time since review
reviewSchema.virtual('daysSinceReview').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// METHOD: Mark as helpful
reviewSchema.methods.markHelpful = async function(userId) {
  // Check if user already marked it helpful
  if (this.markedHelpfulBy.includes(userId)) {
    throw new Error('User has already marked this review as helpful');
  }
  
  this.markedHelpfulBy.push(userId);
  this.helpfulCount += 1;
  await this.save();
};

// METHOD: Unmark as helpful
reviewSchema.methods.unmarkHelpful = async function(userId) {
  const index = this.markedHelpfulBy.indexOf(userId);
  
  if (index === -1) {
    throw new Error('User has not marked this review as helpful');
  }
  
  this.markedHelpfulBy.splice(index, 1);
  this.helpfulCount -= 1;
  await this.save();
};

// METHOD: Add doctor response
reviewSchema.methods.respond = async function(response) {
  if (this.doctorResponse) {
    throw new Error('Doctor has already responded to this review');
  }
  
  this.doctorResponse = response;
  this.respondedAt = new Date();
  await this.save();
};

// METHOD: Hide review (by admin)
reviewSchema.methods.hide = async function(adminId, reason) {
  this.isHidden = true;
  this.hiddenReason = reason;
  this.hiddenBy = adminId;
  this.hiddenAt = new Date();
  await this.save();
};

// METHOD: Unhide review
reviewSchema.methods.unhide = async function() {
  this.isHidden = false;
  this.hiddenReason = undefined;
  this.hiddenBy = undefined;
  this.hiddenAt = undefined;
  await this.save();
};

// STATIC: Get reviews for doctor
reviewSchema.statics.getForDoctor = async function(doctorId, options = {}) {
  const {
    page = 1,
    limit = 10,
    rating = null,
    includeHidden = false
  } = options;
  
  const query = { doctorId };
  
  if (!includeHidden) {
    query.isHidden = false;
  }
  
  if (rating) {
    query.rating = rating;
  }
  
  const skip = (page - 1) * limit;
  
  const reviews = await this.find(query)
    .populate('patientId', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await this.countDocuments(query);
  
  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// STATIC: Get rating distribution for doctor
reviewSchema.statics.getRatingDistribution = async function(doctorId) {
  const distribution = await this.aggregate([
    {
      $match: {
        doctorId: new mongoose.Types.ObjectId(doctorId),
        isHidden: false
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);
  
  // Create full distribution (1-5 stars)
  const result = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };
  
  distribution.forEach(item => {
    result[item._id] = item.count;
  });
  
  const total = Object.values(result).reduce((sum, count) => sum + count, 0);
  
  return {
    distribution: result,
    total
  };
};

// STATIC: Get average rating for doctor
reviewSchema.statics.getAverageRating = async function(doctorId) {
  const result = await this.aggregate([
    {
      $match: {
        doctorId: new mongoose.Types.ObjectId(doctorId),
        isHidden: false
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 
    ? {
        averageRating: Math.round(result[0].averageRating * 10) / 10,
        totalReviews: result[0].totalReviews
      }
    : { averageRating: 0, totalReviews: 0 };
};

// STATIC: Get most helpful reviews for doctor
reviewSchema.statics.getMostHelpful = async function(doctorId, limit = 5) {
  return await this.find({
    doctorId,
    isHidden: false,
    helpfulCount: { $gt: 0 }
  })
  .populate('patientId', 'firstName lastName profilePicture')
  .sort({ helpfulCount: -1, createdAt: -1 })
  .limit(limit);
};

// STATIC: Get recent reviews for doctor
reviewSchema.statics.getRecent = async function(doctorId, limit = 5) {
  return await this.find({
    doctorId,
    isHidden: false
  })
  .populate('patientId', 'firstName lastName profilePicture')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// STATIC: Check if patient can review appointment
reviewSchema.statics.canReview = async function(appointmentId, patientId) {
  const existingReview = await this.findOne({ appointmentId });
  
  if (existingReview) {
    return { canReview: false, reason: 'Review already exists for this appointment' };
  }
  
  // Check if appointment is completed
  const Appointment = mongoose.model('Appointment');
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return { canReview: false, reason: 'Appointment not found' };
  }
  
  if (appointment.patientId.toString() !== patientId.toString()) {
    return { canReview: false, reason: 'Appointment does not belong to this patient' };
  }
  
  if (appointment.status !== 'completed') {
    return { canReview: false, reason: 'Appointment must be completed before reviewing' };
  }
  
  return { canReview: true };
};

// MIDDLEWARE: Update doctor's average rating after save
reviewSchema.post('save', async function() {
  if (!this.isHidden) {
    const Doctor = mongoose.model('Doctor');
    const doctor = await Doctor.findById(this.doctorId);
    
    if (doctor) {
      await doctor.updateRating(this.rating);
    }
  }
});

// MIDDLEWARE: Recalculate doctor rating when review is hidden/unhidden
reviewSchema.post('save', async function(doc) {
  if (this.isModified('isHidden')) {
    const Doctor = mongoose.model('Doctor');
    const stats = await this.constructor.getAverageRating(this.doctorId);
    
    const doctor = await Doctor.findById(this.doctorId);
    if (doctor) {
      doctor.averageRating = stats.averageRating;
      doctor.totalReviews = stats.totalReviews;
      await doctor.save();
    }
  }
});

// Ensure virtuals are included in JSON
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Review', reviewSchema);