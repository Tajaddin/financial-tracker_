// backend/models/Transaction.js
const mongoose = require('mongoose'); // FIXED: Restored missing import

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  // FIXED: Store amounts as integers (minor units - cents)
  amountInMinorUnits: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be an integer (in minor units)'
    }
  },
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'AZN'],
    default: 'USD',
    required: true
  },
  // Store the exchange rate used at transaction time
  exchangeRateToUSD: {
    type: Number,
    required: true
  },
  // Computed USD value in minor units
  amountInUSDMinorUnits: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'USD amount must be an integer (in minor units)'
    }
  },
  description: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true,
    index: true
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

// Indexes for performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, account: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });

// Update timestamp on save
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);