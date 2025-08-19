// backend/models/Transaction.js
const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    required: true,
  },
  category: {
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
    required: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
