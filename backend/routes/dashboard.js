// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Borrowing = require('../models/Borrowing');
// FIXED: Removed unused WorkSchedule import
// const WorkSchedule = require('../models/WorkSchedule');

// Get dashboard summary
router.get('/dashboard-summary', auth, async (req, res) => {
  try {
    const userId = req.userId;
    
    // FIXED: Proper month boundaries with timezone handling
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    
    // Get all accounts
    const accounts = await Account.find({ user: userId, isActive: true });
    
    // Get transactions for current month with proper boundaries
    const transactions = await Transaction.find({
      user: userId,
      date: {
        $gte: startOfMonth,
        $lt: startOfNextMonth  // FIXED: Added upper boundary
      }
    });
    
    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdown = {};
    const dailyData = {};
    
    transactions.forEach(tx => {
      // Use USD amounts for consistent reporting
      const amountInUSD = tx.amountInUSDMinorUnits / 100;
      
      if (tx.type === 'income') {
        totalIncome += amountInUSD;
      } else if (tx.type === 'expense') {
        totalExpenses += amountInUSD;
        
        // Category breakdown for expenses
        if (!categoryBreakdown[tx.category]) {
          categoryBreakdown[tx.category] = 0;
        }
        categoryBreakdown[tx.category] += amountInUSD;
      }
      
      // Daily aggregation
      const dateKey = tx.date.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { income: 0, expenses: 0 };
      }
      
      if (tx.type === 'income') {
        dailyData[dateKey].income += amountInUSD;
      } else if (tx.type === 'expense') {
        dailyData[dateKey].expenses += amountInUSD;
      }
    });
    
    // Calculate account totals by currency
    const accountTotalsByCurrency = {};
    accounts.forEach(account => {
      if (!accountTotalsByCurrency[account.currency]) {
        accountTotalsByCurrency[account.currency] = 0;
      }
      accountTotalsByCurrency[account.currency] += account.balanceInMinorUnits / 100;
    });
    
    // Get borrowing summary
    const borrowings = await Borrowing.find({ 
      user: userId,
      status: { $in: ['pending', 'partially_paid', 'overdue'] }
    });
    
    let totalBorrowed = 0;
    let totalLent = 0;
    
    borrowings.forEach(b => {
      const remainingInUSD = (b.amountInUSDMinorUnits - b.paidAmountInMinorUnits) / 100;
      if (b.type === 'borrowed') {
        totalBorrowed += remainingInUSD;
      } else if (b.type === 'lent') {
        totalLent += remainingInUSD;
      }
    });
    
    // Sort category breakdown
    const topCategories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
      }));
    
    // Convert daily data to array
    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income - data.expenses) * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // FIXED: Removed debug field from response
    res.json({
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netIncome: Math.round((totalIncome - totalExpenses) * 100) / 100,
        savingsRate: totalIncome > 0 
          ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) 
          : 0
      },
      accounts: {
        count: accounts.length,
        totalsByCurrency: accountTotalsByCurrency
      },
      borrowings: {
        totalBorrowed: Math.round(totalBorrowed * 100) / 100,
        totalLent: Math.round(totalLent * 100) / 100,
        netPosition: Math.round((totalLent - totalBorrowed) * 100) / 100
      },
      topCategories,
      dailyTrend,
      period: {
        start: startOfMonth.toISOString(),
        end: startOfNextMonth.toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating dashboard summary:', error);
    res.status(500).json({ error: 'Failed to generate dashboard summary' });
  }
});

// Get yearly summary
router.get('/yearly-summary', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    
    const transactions = await Transaction.find({
      user: userId,
      date: {
        $gte: startOfYear,
        $lt: startOfNextYear
      }
    });
    
    // Monthly aggregation
    const monthlyData = {};
    
    for (let month = 0; month < 12; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = {
        income: 0,
        expenses: 0,
        transactions: 0
      };
    }
    
    transactions.forEach(tx => {
      const monthKey = tx.date.toISOString().substring(0, 7);
      const amountInUSD = tx.amountInUSDMinorUnits / 100;
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].transactions++;
        
        if (tx.type === 'income') {
          monthlyData[monthKey].income += amountInUSD;
        } else if (tx.type === 'expense') {
          monthlyData[monthKey].expenses += amountInUSD;
        }
      }
    });
    
    // Convert to array and calculate totals
    let yearlyIncome = 0;
    let yearlyExpenses = 0;
    
    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => {
        yearlyIncome += data.income;
        yearlyExpenses += data.expenses;
        
        return {
          month,
          income: Math.round(data.income * 100) / 100,
          expenses: Math.round(data.expenses * 100) / 100,
          net: Math.round((data.income - data.expenses) * 100) / 100,
          transactions: data.transactions
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
    
    res.json({
      year,
      summary: {
        totalIncome: Math.round(yearlyIncome * 100) / 100,
        totalExpenses: Math.round(yearlyExpenses * 100) / 100,
        netIncome: Math.round((yearlyIncome - yearlyExpenses) * 100) / 100,
        averageMonthlyIncome: Math.round((yearlyIncome / 12) * 100) / 100,
        averageMonthlyExpenses: Math.round((yearlyExpenses / 12) * 100) / 100,
        savingsRate: yearlyIncome > 0 
          ? Math.round(((yearlyIncome - yearlyExpenses) / yearlyIncome) * 100)
          : 0
      },
      monthlyTrend
    });
  } catch (error) {
    console.error('Error generating yearly summary:', error);
    res.status(500).json({ error: 'Failed to generate yearly summary' });
  }
});

module.exports = router;