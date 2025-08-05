const mongoose = require('mongoose');

const borrowingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['lent', 'borrowed'],
    required: true,
  },
  personName: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'AZN'],
    default: 'USD',
  },
  amountInUSD: {
    type: Number,
    required: true,
  },
  description: String,
  date: {
    type: Date,
    required: true,
  },
  dueDate: Date,
  isPaid: {
    type: Boolean,
    default: false,
  },
  paidDate: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Borrowing', borrowingSchema);