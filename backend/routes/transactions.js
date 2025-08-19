// backend/routes/transactions.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { convertCurrency, getExchangeRateToUSD } = require('../utils/currencyConverter');

// Validation middleware for transaction creation
const validateTransaction = [
  body('accountId').isMongoId().withMessage('Invalid account ID'),
  body('type').isIn(['income', 'expense', 'transfer']).withMessage('Invalid transaction type'),
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
  body('currency').optional().isIn(['USD', 'EUR', 'AZN']).withMessage('Invalid currency'),
  body('description').optional().trim(),
  body('date').isISO8601().toDate().withMessage('Invalid date format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Get all transactions for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const { 
      accountId, 
      type, 
      category, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    // Build query
    const query = { user: req.userId };
    
    if (accountId) {
      // Verify account belongs to user
      const account = await Account.findOne({ _id: accountId, user: req.userId });
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      query.account = accountId;
    }
    
    if (type) query.type = type;
    if (category) query.category = new RegExp(category, 'i');
    
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('account', 'name type currency')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);
    
    // Convert minor units to major units for response
    const formattedTransactions = transactions.map(t => ({
      _id: t._id,
      account: t.account,
      type: t.type,
      category: t.category,
      amount: t.amountInMinorUnits / 100,
      currency: t.currency,
      amountInUSD: t.amountInUSDMinorUnits / 100,
      description: t.description,
      date: t.date,
      createdAt: t.createdAt
    }));
    
    res.json({
      transactions: formattedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create a new transaction
router.post('/', auth, validateTransaction, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { accountId, type, category, amount, currency, description, date } = req.body;
      
      // FIXED: Properly scope account lookup by user
      const account = await Account.findOne({ 
        _id: accountId, 
        user: req.userId 
      }).session(session);
      
      if (!account) {
        throw new Error('Account not found');
      }
      
      if (!account.isActive) {
        throw new Error('Account is inactive');
      }
      
      // Convert amount to minor units (cents)
      const amountInMinorUnits = Math.round(amount * 100);
      
      // Use transaction currency or default to account currency
      const txCurrency = currency || account.currency;
      const txDate = new Date(date);
      
      // Get exchange rate for the transaction date
      const exchangeRateToUSD = getExchangeRateToUSD(txCurrency, txDate);
      if (!exchangeRateToUSD) {
        throw new Error(`Exchange rate not available for ${txCurrency}`);
      }
      
      // Calculate USD amount
      const usdConversion = convertCurrency(
        amountInMinorUnits, 
        txCurrency, 
        'USD', 
        txDate
      );
      
      // FIXED: Handle cross-currency transactions
      let accountBalanceDelta = amountInMinorUnits;
      if (txCurrency !== account.currency) {
        const accountConversion = convertCurrency(
          amountInMinorUnits,
          txCurrency,
          account.currency,
          txDate
        );
        accountBalanceDelta = accountConversion.amountInMinorUnits;
      }
      
      // Update account balance
      if (type === 'income') {
        account.balanceInMinorUnits += accountBalanceDelta;
      } else if (type === 'expense') {
        account.balanceInMinorUnits -= accountBalanceDelta;
        
        // Check for insufficient funds
        if (account.balanceInMinorUnits < 0 && account.type !== 'credit') {
          throw new Error('Insufficient funds');
        }
      }
      
      // Create transaction
      const transaction = new Transaction({
        user: req.userId,
        account: accountId,
        type,
        category,
        amountInMinorUnits,
        currency: txCurrency,
        exchangeRateToUSD,
        amountInUSDMinorUnits: usdConversion.amountInMinorUnits,
        description,
        date: txDate
      });
      
      // Save both in the same transaction
      await transaction.save({ session });
      await account.save({ session });
      
      // Populate account info for response
      await transaction.populate('account', 'name type currency');
      
      // Format response
      res.status(201).json({
        _id: transaction._id,
        account: transaction.account,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amountInMinorUnits / 100,
        currency: transaction.currency,
        amountInUSD: transaction.amountInUSDMinorUnits / 100,
        description: transaction.description,
        date: transaction.date,
        createdAt: transaction.createdAt,
        updatedBalance: account.balanceInMinorUnits / 100
      });
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to create transaction' });
  } finally {
    await session.endSession();
  }
});

// Update a transaction
router.put('/:id', auth, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const updates = req.body;
      
      // Find the transaction
      const transaction = await Transaction.findOne({
        _id: id,
        user: req.userId
      }).session(session);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Get the account
      const account = await Account.findOne({
        _id: transaction.account,
        user: req.userId
      }).session(session);
      
      if (!account) {
        throw new Error('Account not found');
      }
      
      // Reverse the old transaction from balance
      const oldAmountInAccountCurrency = transaction.currency === account.currency
        ? transaction.amountInMinorUnits
        : convertCurrency(
            transaction.amountInMinorUnits,
            transaction.currency,
            account.currency,
            transaction.date
          ).amountInMinorUnits;
      
      if (transaction.type === 'income') {
        account.balanceInMinorUnits -= oldAmountInAccountCurrency;
      } else if (transaction.type === 'expense') {
        account.balanceInMinorUnits += oldAmountInAccountCurrency;
      }
      
      // Apply updates
      if (updates.amount !== undefined) {
        transaction.amountInMinorUnits = Math.round(updates.amount * 100);
      }
      if (updates.type) transaction.type = updates.type;
      if (updates.category) transaction.category = updates.category;
      if (updates.description !== undefined) transaction.description = updates.description;
      if (updates.date) transaction.date = new Date(updates.date);
      if (updates.currency) transaction.currency = updates.currency;
      
      // Recalculate USD amount with potentially new values
      const exchangeRateToUSD = getExchangeRateToUSD(transaction.currency, transaction.date);
      transaction.exchangeRateToUSD = exchangeRateToUSD;
      
      const usdConversion = convertCurrency(
        transaction.amountInMinorUnits,
        transaction.currency,
        'USD',
        transaction.date
      );
      transaction.amountInUSDMinorUnits = usdConversion.amountInMinorUnits;
      
      // Apply new transaction to balance
      const newAmountInAccountCurrency = transaction.currency === account.currency
        ? transaction.amountInMinorUnits
        : convertCurrency(
            transaction.amountInMinorUnits,
            transaction.currency,
            account.currency,
            transaction.date
          ).amountInMinorUnits;
      
      if (transaction.type === 'income') {
        account.balanceInMinorUnits += newAmountInAccountCurrency;
      } else if (transaction.type === 'expense') {
        account.balanceInMinorUnits -= newAmountInAccountCurrency;
      }
      
      // Save both
      await transaction.save({ session });
      await account.save({ session });
      
      await transaction.populate('account', 'name type currency');
      
      res.json({
        _id: transaction._id,
        account: transaction.account,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amountInMinorUnits / 100,
        currency: transaction.currency,
        amountInUSD: transaction.amountInUSDMinorUnits / 100,
        description: transaction.description,
        date: transaction.date,
        updatedBalance: account.balanceInMinorUnits / 100
      });
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to update transaction' });
  } finally {
    await session.endSession();
  }
});

// Delete a transaction
router.delete('/:id', auth, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      
      const transaction = await Transaction.findOne({
        _id: id,
        user: req.userId
      }).session(session);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Get and update account balance
      const account = await Account.findOne({
        _id: transaction.account,
        user: req.userId
      }).session(session);
      
      if (account) {
        // Reverse the transaction
        const amountInAccountCurrency = transaction.currency === account.currency
          ? transaction.amountInMinorUnits
          : convertCurrency(
              transaction.amountInMinorUnits,
              transaction.currency,
              account.currency,
              transaction.date
            ).amountInMinorUnits;
        
        if (transaction.type === 'income') {
          account.balanceInMinorUnits -= amountInAccountCurrency;
        } else if (transaction.type === 'expense') {
          account.balanceInMinorUnits += amountInAccountCurrency;
        }
        
        await account.save({ session });
      }
      
      await transaction.deleteOne({ session });
      
      res.json({ 
        message: 'Transaction deleted successfully',
        updatedBalance: account ? account.balanceInMinorUnits / 100 : null
      });
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to delete transaction' });
  } finally {
    await session.endSession();
  }
});

module.exports = router;