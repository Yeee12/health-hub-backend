const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required']
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
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'NGN',
    uppercase: true,
    enum: {
      values: ['NGN', 'USD', 'GBP', 'EUR'],
      message: 'Currency must be NGN, USD, GBP, or EUR'
    }
  },
  platformFee: {
    type: Number,
    default: 0,
    min: [0, 'Platform fee cannot be negative']
  },
  doctorEarnings: {
    type: Number,
    default: 0,
    min: [0, 'Doctor earnings cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['paystack', 'stripe', 'card', 'bank_transfer', 'wallet'],
      message: 'Invalid payment method'
    },
    required: [true, 'Payment method is required']
  },
  paymentGateway: {
    type: String,
    enum: ['paystack', 'stripe'],
    required: [true, 'Payment gateway is required']
  },
  transactionReference: {
    type: String,
    required: [true, 'Transaction reference is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'successful', 'failed', 'refunded', 'partially_refunded'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed, // Stores full response from payment gateway
    default: {}
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount cannot be negative']
  },
  refundReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Refund reason cannot exceed 500 characters']
  },
  refundedAt: {
    type: Date
  },
  refundReference: {
    type: String,
    trim: true,
    uppercase: true
  },
  payoutStatus: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'completed', 'failed'],
      message: 'Invalid payout status'
    },
    default: 'pending'
  },
  payoutReference: {
    type: String,
    trim: true,
    uppercase: true
  },
  paidOutAt: {
    type: Date
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// INDEXES
// Note: transactionReference already has an index from 'unique: true'
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ patientId: 1 });
paymentSchema.index({ doctorId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ payoutStatus: 1 });
paymentSchema.index({ createdAt: -1 });

// VIRTUAL: Is payment successful
paymentSchema.virtual('isSuccessful').get(function() {
  return this.status === 'successful';
});

// VIRTUAL: Is fully refunded
paymentSchema.virtual('isFullyRefunded').get(function() {
  return this.status === 'refunded' && this.refundAmount === this.amount;
});

// VIRTUAL: Is partially refunded
paymentSchema.virtual('isPartiallyRefunded').get(function() {
  return this.status === 'partially_refunded' && this.refundAmount < this.amount;
});

// VIRTUAL: Remaining amount (after refund)
paymentSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.refundAmount;
});

// VIRTUAL: Is payout complete
paymentSchema.virtual('isPayoutComplete').get(function() {
  return this.payoutStatus === 'completed';
});

// METHOD: Mark as successful
paymentSchema.methods.markSuccessful = async function(gatewayResponse = {}) {
  this.status = 'successful';
  this.gatewayResponse = gatewayResponse;
  await this.save();
};

// METHOD: Mark as failed
paymentSchema.methods.markFailed = async function(gatewayResponse = {}) {
  this.status = 'failed';
  this.gatewayResponse = gatewayResponse;
  await this.save();
};

// METHOD: Process refund
paymentSchema.methods.processRefund = async function(refundAmount, reason, refundRef) {
  if (refundAmount > this.amount - this.refundAmount) {
    throw new Error('Refund amount exceeds available amount');
  }
  
  this.refundAmount += refundAmount;
  this.refundReason = reason;
  this.refundedAt = new Date();
  this.refundReference = refundRef;
  
  if (this.refundAmount === this.amount) {
    this.status = 'refunded';
  } else {
    this.status = 'partially_refunded';
  }
  
  await this.save();
};

// METHOD: Mark payout as processing
paymentSchema.methods.startPayout = async function() {
  if (this.status !== 'successful') {
    throw new Error('Can only payout successful payments');
  }
  
  this.payoutStatus = 'processing';
  await this.save();
};

// METHOD: Complete payout
paymentSchema.methods.completePayout = async function(payoutRef) {
  this.payoutStatus = 'completed';
  this.payoutReference = payoutRef;
  this.paidOutAt = new Date();
  await this.save();
};

// METHOD: Fail payout
paymentSchema.methods.failPayout = async function() {
  this.payoutStatus = 'failed';
  await this.save();
};

// STATIC: Get total earnings for doctor
paymentSchema.statics.getDoctorEarnings = async function(doctorId, startDate = null, endDate = null) {
  const query = {
    doctorId,
    status: 'successful'
  };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$doctorEarnings' },
        totalTransactions: { $sum: 1 },
        totalRefunded: { $sum: '$refundAmount' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { totalEarnings: 0, totalTransactions: 0, totalRefunded: 0 };
};

// STATIC: Get platform revenue
paymentSchema.statics.getPlatformRevenue = async function(startDate = null, endDate = null) {
  const query = {
    status: 'successful'
  };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$platformFee' },
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { totalRevenue: 0, totalTransactions: 0, totalAmount: 0 };
};

// STATIC: Get pending payouts
paymentSchema.statics.getPendingPayouts = async function(doctorId = null) {
  const query = {
    status: 'successful',
    payoutStatus: 'pending'
  };
  
  if (doctorId) {
    query.doctorId = doctorId;
  }
  
  return await this.find(query)
    .populate('doctorId', 'firstName lastName bankDetails')
    .populate('appointmentId', 'appointmentDate consultationType')
    .sort({ createdAt: 1 });
};

// STATIC: Get payment by transaction reference
paymentSchema.statics.findByReference = async function(reference) {
  return await this.findOne({ transactionReference: reference.toUpperCase() });
};

// MIDDLEWARE: Calculate platform fee and doctor earnings before save
paymentSchema.pre('save', function() {
  if (this.isNew || this.isModified('amount')) {
    // Platform takes 10% commission
    this.platformFee = Math.round(this.amount * 0.10);
    this.doctorEarnings = this.amount - this.platformFee;
  }
});

// MIDDLEWARE: Update transaction reference to uppercase
paymentSchema.pre('save', function() {
  if (this.transactionReference) {
    this.transactionReference = this.transactionReference.toUpperCase();
  }
  if (this.refundReference) {
    this.refundReference = this.refundReference.toUpperCase();
  }
  if (this.payoutReference) {
    this.payoutReference = this.payoutReference.toUpperCase();
  }
});

// Ensure virtuals are included in JSON
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', paymentSchema);