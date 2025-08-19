// backend/routes/borrowings.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Borrowing = require('../models/Borrowing');
const auth = require('../middleware/auth');
const { borrowingValidation } = require('../middleware/validation');
const { getExchangeRateToUSD, convertCurrency } = require('../utils/currencyConverter');

/**
 * @route   GET /api/borrowings
 * @desc    Get all borrowings for user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { type, status, counterparty, page = 1, limit = 50 } = req.query;
    
    // Build query
    const query = { user: req.userId };
    
    if (type) query.type = type;
    if (status) {
      if (status === 'active') {
        query.status = { $in: ['pending', 'partially_paid', 'overdue'] };
      } else {
        query.status = status;
      }
    }
    if (counterparty) {
      query.counterparty = new RegExp(counterparty, 'i');
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const [borrowings, total] = await Promise.all([
      Borrowing.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Borrowing.countDocuments(query)
    ]);
    
    // Update overdue status for pending borrowings
    const now = new Date();
    for (const borrowing of borrowings) {
      if (borrowing.status === 'pending' && borrowing.dueDate && borrowing.dueDate < now) {
        borrowing.status = 'overdue';
        await borrowing.save();
      }
    }
    
    // Format response
    const formattedBorrowings = borrowings.map(b => ({
      _id: b._id,
      type: b.type,
      counterparty: b.counterparty,
      amount: b.amountInMinorUnits / 100,
      currency: b.currency,
      amountInUSD: b.amountInUSDMinorUnits / 100,
      remainingAmount: (b.amountInMinorUnits - b.paidAmountInMinorUnits) / 100,
      paidAmount: b.paidAmountInMinorUnits / 100,
      description: b.description,
      date: b.date,
      dueDate: b.dueDate,
      status: b.status,
      createdAt: b.createdAt
    }));
    
    // Calculate summary
    const summary = {
      totalBorrowed: 0,
      totalLent: 0,
      activeBorrowed: 0,
      activeLent: 0,
      overdue: 0
    };
    
    borrowings.forEach(b => {
      const remainingUSD = (b.amountInUSDMinorUnits - b.paidAmountInMinorUnits) / 100;
      
      if (b.type === 'borrowed') {
        summary.totalBorrowed += b.amountInUSDMinorUnits / 100;
        if (b.status !== 'paid') {
          summary.activeBorrowed += remainingUSD;
        }
      } else {
        summary.totalLent += b.amountInUSDMinorUnits / 100;
        if (b.status !== 'paid') {
          summary.activeLent += remainingUSD;
        }
      }
      
      if (b.status === 'overdue') {
        summary.overdue += remainingUSD;
      }
    });
    
    res.json({
      borrowings: formattedBorrowings,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching borrowings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch borrowings' 
    });
  }
});

/**
 * @route   GET /api/borrowings/:id
 * @desc    Get single borrowing with payment history
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const borrowing = await Borrowing.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!borrowing) {
      return res.status(404).json({ 
        error: 'Borrowing record not found' 
      });
    }
    
    // Check and update overdue status
    if (borrowing.status === 'pending' && borrowing.dueDate && borrowing.dueDate < new Date()) {
      borrowing.status = 'overdue';
      await borrowing.save();
    }
    
    res.json({
      borrowing: {
        _id: borrowing._id,
        type: borrowing.type,
        counterparty: borrowing.counterparty,
        amount: borrowing.amountInMinorUnits / 100,
        currency: borrowing.currency,
        amountInUSD: borrowing.amountInUSDMinorUnits / 100,
        remainingAmount: (borrowing.amountInMinorUnits - borrowing.paidAmountInMinorUnits) / 100,
        paidAmount: borrowing.paidAmountInMinorUnits / 100,
        percentagePaid: Math.round((borrowing.paidAmountInMinorUnits / borrowing.amountInMinorUnits) * 100),
        description: borrowing.description,
        date: borrowing.date,
        dueDate: borrowing.dueDate,
        status: borrowing.status,
        createdAt: borrowing.createdAt,
        updatedAt: borrowing.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching borrowing:', error);
    res.status(500).json({ 
      error: 'Failed to fetch borrowing details' 
    });
  }
});

/**
 * @route   POST /api/borrowings
 * @desc    Create new borrowing record
 * @access  Private
 */
router.post('/', auth, borrowingValidation.create, async (req, res) => {
  try {
    const { 
      type, 
      counterparty, 
      amount, 
      currency = 'USD', 
      description, 
      date, 
      dueDate 
    } = req.body;
    
    // Convert amount to minor units
    const amountInMinorUnits = Math.round(amount * 100);
    
    // Get exchange rate for the date
    const borrowingDate = new Date(date || Date.now());
    const exchangeRateToUSD = getExchangeRateToUSD(currency, borrowingDate);
    
    if (!exchangeRateToUSD) {
      return res.status(400).json({ 
        error: `Exchange rate not available for ${currency}` 
      });
    }
    
    // Calculate USD amount
    const usdConversion = convertCurrency(
      amountInMinorUnits,
      currency,
      'USD',
      borrowingDate
    );
    
    // Create borrowing record
    const borrowing = new Borrowing({
      user: req.userId,
      type,
      counterparty,
      amountInMinorUnits,
      currency,
      exchangeRateToUSD,
      amountInUSDMinorUnits: usdConversion.amountInMinorUnits,
      description: description || '',
      date: borrowingDate,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: 'pending',
      paidAmountInMinorUnits: 0
    });
    
    await borrowing.save();
    
    res.status(201).json({
      message: 'Borrowing record created successfully',
      borrowing: {
        _id: borrowing._id,
        type: borrowing.type,
        counterparty: borrowing.counterparty,
        amount: borrowing.amountInMinorUnits / 100,
        currency: borrowing.currency,
        amountInUSD: borrowing.amountInUSDMinorUnits / 100,
        description: borrowing.description,
        date: borrowing.date,
        dueDate: borrowing.dueDate,
        status: borrowing.status
      }
    });
  } catch (error) {
    console.error('Error creating borrowing:', error);
    res.status(500).json({ 
      error: 'Failed to create borrowing record' 
    });
  }
});

/**
 * @route   PUT /api/borrowings/:id
 * @desc    Update borrowing record
 * @access  Private
 */
router.put('/:id', auth, borrowingValidation.update, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const borrowing = await Borrowing.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!borrowing) {
      return res.status(404).json({ 
        error: 'Borrowing record not found' 
      });
    }
    
    // Handle payment update
    if (updates.paidAmount !== undefined) {
      const paidAmountInMinorUnits = Math.round(updates.paidAmount * 100);
      
      if (paidAmountInMinorUnits > borrowing.amountInMinorUnits) {
        return res.status(400).json({ 
          error: 'Paid amount cannot exceed borrowed amount' 
        });
      }
      
      borrowing.paidAmountInMinorUnits = paidAmountInMinorUnits;
      
      // Update status based on payment
      if (paidAmountInMinorUnits >= borrowing.amountInMinorUnits) {
        borrowing.status = 'paid';
      } else if (paidAmountInMinorUnits > 0) {
        borrowing.status = 'partially_paid';
      }
    }
    
    // Update other fields
    if (updates.description !== undefined) borrowing.description = updates.description;
    if (updates.dueDate !== undefined) {
      borrowing.dueDate = updates.dueDate ? new Date(updates.dueDate) : undefined;
    }
    if (updates.status && !updates.paidAmount) {
      // Allow manual status update only if not updating payment
      borrowing.status = updates.status;
    }
    
    // Check for overdue
    if (borrowing.dueDate && borrowing.dueDate < new Date() && 
        borrowing.status === 'pending') {
      borrowing.status = 'overdue';
    }
    
    await borrowing.save();
    
    res.json({
      message: 'Borrowing record updated successfully',
      borrowing: {
        _id: borrowing._id,
        type: borrowing.type,
        counterparty: borrowing.counterparty,
        amount: borrowing.amountInMinorUnits / 100,
        currency: borrowing.currency,
        remainingAmount: (borrowing.amountInMinorUnits - borrowing.paidAmountInMinorUnits) / 100,
        paidAmount: borrowing.paidAmountInMinorUnits / 100,
        description: borrowing.description,
        dueDate: borrowing.dueDate,
        status: borrowing.status
      }
    });
  } catch (error) {
    console.error('Error updating borrowing:', error);
    res.status(500).json({ 
      error: 'Failed to update borrowing record' 
    });
  }
});

/**
 * @route   POST /api/borrowings/:id/payment
 * @desc    Record a payment for borrowing
 * @access  Private
 */
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentDate = new Date() } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Payment amount must be positive' 
      });
    }
    
    const borrowing = await Borrowing.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!borrowing) {
      return res.status(404).json({ 
        error: 'Borrowing record not found' 
      });
    }
    
    if (borrowing.status === 'paid') {
      return res.status(400).json({ 
        error: 'This borrowing is already fully paid' 
      });
    }
    
    const paymentInMinorUnits = Math.round(amount * 100);
    const newPaidAmount = borrowing.paidAmountInMinorUnits + paymentInMinorUnits;
    
    if (newPaidAmount > borrowing.amountInMinorUnits) {
      return res.status(400).json({ 
        error: 'Payment would exceed the borrowed amount' 
      });
    }
    
    borrowing.paidAmountInMinorUnits = newPaidAmount;
    
    // Update status
    if (newPaidAmount >= borrowing.amountInMinorUnits) {
      borrowing.status = 'paid';
    } else {
      borrowing.status = 'partially_paid';
    }
    
    await borrowing.save();
    
    res.json({
      message: 'Payment recorded successfully',
      borrowing: {
        _id: borrowing._id,
        type: borrowing.type,
        counterparty: borrowing.counterparty,
        totalAmount: borrowing.amountInMinorUnits / 100,
        paidAmount: borrowing.paidAmountInMinorUnits / 100,
        remainingAmount: (borrowing.amountInMinorUnits - borrowing.paidAmountInMinorUnits) / 100,
        status: borrowing.status,
        percentagePaid: Math.round((borrowing.paidAmountInMinorUnits / borrowing.amountInMinorUnits) * 100)
      },
      payment: {
        amount: paymentInMinorUnits / 100,
        date: paymentDate
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ 
      error: 'Failed to record payment' 
    });
  }
});

/**
 * @route   DELETE /api/borrowings/:id
 * @desc    Delete borrowing record
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const borrowing = await Borrowing.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!borrowing) {
      return res.status(404).json({ 
        error: 'Borrowing record not found' 
      });
    }
    
    // Warn if deleting active borrowing
    if (borrowing.status !== 'paid' && borrowing.paidAmountInMinorUnits > 0) {
      const { confirmDelete } = req.query;
      
      if (confirmDelete !== 'true') {
        return res.status(400).json({ 
          error: 'This borrowing has partial payments. Add ?confirmDelete=true to proceed',
          warning: {
            status: borrowing.status,
            paidAmount: borrowing.paidAmountInMinorUnits / 100,
            remainingAmount: (borrowing.amountInMinorUnits - borrowing.paidAmountInMinorUnits) / 100
          }
        });
      }
    }
    
    await borrowing.deleteOne();
    
    res.json({
      message: 'Borrowing record deleted successfully',
      deleted: {
        _id: borrowing._id,
        type: borrowing.type,
        counterparty: borrowing.counterparty,
        amount: borrowing.amountInMinorUnits / 100
      }
    });
  } catch (error) {
    console.error('Error deleting borrowing:', error);
    res.status(500).json({ 
      error: 'Failed to delete borrowing record' 
    });
  }
});

/**
 * @route   GET /api/borrowings/statistics
 * @desc    Get borrowing statistics
 * @access  Private
 */
router.get('/statistics/summary', auth, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year + 1, 0, 1));
    
    const borrowings = await Borrowing.find({
      user: req.userId,
      date: {
        $gte: startOfYear,
        $lt: endOfYear
      }
    });
    
    // Calculate statistics
    const stats = {
      borrowed: {
        total: 0,
        paid: 0,
        pending: 0,
        count: 0
      },
      lent: {
        total: 0,
        received: 0,
        pending: 0,
        count: 0
      },
      overdue: {
        count: 0,
        amount: 0
      },
      byMonth: {}
    };
    
    // Initialize months
    for (let month = 0; month < 12; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      stats.byMonth[monthKey] = {
        borrowed: 0,
        lent: 0,
        payments: 0
      };
    }
    
    borrowings.forEach(b => {
      const monthKey = b.date.toISOString().substring(0, 7);
      const amountUSD = b.amountInUSDMinorUnits / 100;
      const paidUSD = b.paidAmountInMinorUnits / 100;
      
      if (b.type === 'borrowed') {
        stats.borrowed.total += amountUSD;
        stats.borrowed.paid += paidUSD;
        stats.borrowed.pending += (amountUSD - paidUSD);
        stats.borrowed.count++;
        
        if (stats.byMonth[monthKey]) {
          stats.byMonth[monthKey].borrowed += amountUSD;
        }
      } else {
        stats.lent.total += amountUSD;
        stats.lent.received += paidUSD;
        stats.lent.pending += (amountUSD - paidUSD);
        stats.lent.count++;
        
        if (stats.byMonth[monthKey]) {
          stats.byMonth[monthKey].lent += amountUSD;
        }
      }
      
      if (b.status === 'overdue') {
        stats.overdue.count++;
        stats.overdue.amount += (amountUSD - paidUSD);
      }
    });
    
    res.json({
      year,
      statistics: stats,
      netPosition: stats.lent.pending - stats.borrowed.pending
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch borrowing statistics' 
    });
  }
});

module.exports = router;