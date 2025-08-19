// backend/models/Borrowing.js
const mongoose = require('mongoose');

const borrowingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['borrowed', 'lent'],
    required: true
  },
  counterparty: {
    type: String,
    required: true,
    trim: true
  },
  // FIXED: Store amounts as integers (minor units)
  amountInMinorUnits: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be an integer (in minor units)'
    }
  },
  // FIXED: Aligned currency enum with other models
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'AZN'],
    default: 'USD',
    required: true
  },
  // Store the exchange rate used at borrowing time
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
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'partially_paid', 'paid', 'overdue'],
    default: 'pending'
  },
  paidAmountInMinorUnits: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Paid amount must be an integer (in minor units)'
    }
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

// Indexes
borrowingSchema.index({ user: 1, status: 1 });
borrowingSchema.index({ user: 1, type: 1, date: -1 });

// Update timestamp on save
borrowingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-update status based on payment
  if (this.paidAmountInMinorUnits >= this.amountInMinorUnits) {
    this.status = 'paid';
  } else if (this.paidAmountInMinorUnits > 0) {
    this.status = 'partially_paid';
  } else if (this.dueDate && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

module.exports = mongoose.model('Borrowing', borrowingSchema);