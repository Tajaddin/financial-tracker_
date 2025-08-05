const express = require('express');
const router = express.Router();
const WorkSchedule = require('../models/WorkSchedule');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Get work schedule
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.userId };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const schedule = await WorkSchedule.find(filter)
      .sort({ date: -1 });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create work entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, position, hourlyRate, startTime, endTime, tips, notes, accountId } = req.body;
    
    // Calculate hours worked
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let hoursWorked = (end - start) / (1000 * 60 * 60);
    if (hoursWorked < 0) hoursWorked += 24; // Handle overnight shifts
    
    const regularEarnings = hoursWorked * hourlyRate;
    const totalEarnings = regularEarnings + (tips || 0);
    
    const workEntry = new WorkSchedule({
      user: req.userId,
      date: new Date(date),
      position,
      hourlyRate,
      startTime,
      endTime,
      hoursWorked,
      regularEarnings,
      tips: tips || 0,
      totalEarnings,
      notes,
    });

    await workEntry.save();

    // Create transactions for earnings
    if (accountId) {
      // Regular earnings transaction
      await new Transaction({
        user: req.userId,
        account: accountId,
        type: 'income',
        category: 'Salary',
        amount: regularEarnings,
        originalAmount: regularEarnings,
        originalCurrency: 'USD',
        amountInUSD: regularEarnings,
        description: `Work: ${position} - ${hoursWorked}h @ $${hourlyRate}/h`,
        date: new Date(date),
      }).save();

      // Tips transaction if applicable
      if (tips > 0) {
        await new Transaction({
          user: req.userId,
          account: accountId,
          type: 'income',
          category: 'Tips',
          amount: tips,
          originalAmount: tips,
          originalCurrency: 'USD',
          amountInUSD: tips,
          description: `Tips from ${position}`,
          date: new Date(date),
        }).save();
      }
    }

    res.json(workEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;