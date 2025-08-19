// backend/models/Account.js
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['checking', 'savings', 'credit', 'investment', 'cash'],
    required: true
  },
  // FIXED: Store balance as integer (minor units - cents)
  balanceInMinorUnits: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Balance must be an integer (in minor units)'
    }
  },
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'AZN'],
    default: 'USD',
    required: true
  },
  institution: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: '',
    select: false // Don't include by default for security
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for user queries
accountSchema.index({ user: 1, isActive: 1 });

// Update timestamp on save
accountSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper method to get balance in major units (dollars/euros)
accountSchema.methods.getBalanceInMajorUnits = function() {
  return this.balanceInMinorUnits / 100;
};

// Helper method to set balance in major units
accountSchema.methods.setBalanceInMajorUnits = function(amount) {
  this.balanceInMinorUnits = Math.round(amount * 100);
};

module.exports = mongoose.model('Account', accountSchema);