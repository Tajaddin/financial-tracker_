const express = require('express');
const router = express.Router();
const Borrowing = require('../models/Borrowing');
const auth = require('../middleware/auth');
const { convertToUSD } = require('../utils/currencyConverter');

// Get all borrowings
router.get('/', auth, async (req, res) => {
  try {
    const borrowings = await Borrowing.find({ user: req.userId })
      .sort({ date: -1 });
    res.json(borrowings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create borrowing
router.post('/', auth, async (req, res) => {
  try {
    const { type, personName, amount, currency, description, date, dueDate } = req.body;
    
    const amountInUSD = convertToUSD(amount, currency || 'USD');
    
    const borrowing = new Borrowing({
      user: req.userId,
      type,
      personName,
      amount,
      currency: currency || 'USD',
      amountInUSD,
      description,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    await borrowing.save();
    res.json(borrowing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update borrowing (mark as paid)
router.put('/:id/paid', auth, async (req, res) => {
  try {
    const borrowing = await Borrowing.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { isPaid: true, paidDate: new Date() },
      { new: true }
    );
    res.json(borrowing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;