// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Borrowing = require('../models/Borrowing');
const WorkSchedule = require('../models/WorkSchedule');
const auth = require('../middleware/auth');
const { convertToUSD } = require('../utils/currencyConverter');

router.get('/dashboard-summary', auth, async (req, res) => {
  try {
    const userId = req.userId;
    
    // 1. Get all accounts and calculate total balance in USD
    const accounts = await Account.find({ user: userId });
    
    const totalBalanceUSD = accounts.reduce((total, account) => {
      const balanceInUSD = convertToUSD(account.balance, account.currency);
      return total + balanceInUSD;
    }, 0);
    
    // 2. Get current month transactions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: startOfMonth }
    });
    
    // Calculate monthly income and expenses in USD
    let monthlyIncomeUSD = 0;
    let monthlyExpenseUSD = 0;
    
    transactions.forEach(transaction => {
      const amountInUSD = transaction.amountInUSD || convertToUSD(transaction.amount, transaction.currency);
      
      if (transaction.type === 'income') {
        monthlyIncomeUSD += amountInUSD;
      } else if (transaction.type === 'expense') {
        monthlyExpenseUSD += amountInUSD;
      }
    });
    
    // 3. Get pending borrowings
    const borrowings = await Borrowing.find({ 
      user: userId, 
      isPaid: false 
    });
    
    const pendingBorrowingsUSD = borrowings.reduce((total, borrowing) => {
      const amountInUSD = convertToUSD(borrowing.amount, borrowing.currency || 'USD');
      return total + (borrowing.type === 'lent' ? amountInUSD : -amountInUSD);
    }, 0);
    
    // 4. Debug information
    console.log('Dashboard Debug Info:');
    accounts.forEach(acc => {
      console.log(`Account: ${acc.name}, Balance: ${acc.balance} ${acc.currency}, USD: ${convertToUSD(acc.balance, acc.currency)}`);
    });
    
    res.json({
      totalBalance: totalBalanceUSD,
      monthlyIncome: monthlyIncomeUSD,
      monthlyExpense: monthlyExpenseUSD,
      pendingBorrowings: pendingBorrowingsUSD,
      accounts: accounts.map(acc => ({
        ...acc.toObject(),
        balanceInUSD: convertToUSD(acc.balance, acc.currency)
      })),
      debug: {
        exchangeRates: {
          AZN_TO_USD: 1 / 1.7015,
          USD_TO_AZN: 1.7015
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;