// backend/routes/accounts.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { accountValidation } = require('../middleware/validation');

/**
 * @route   GET /api/accounts
 * @desc    Get all accounts for user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { isActive, type } = req.query;
    
    // Build query
    const query = { user: req.userId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (type) {
      query.type = type;
    }
    
    const accounts = await Account.find(query)
      .sort({ name: 1 });
    
    // Format response with major units
    const formattedAccounts = accounts.map(account => ({
      _id: account._id,
      name: account.name,
      type: account.type,
      balance: account.balanceInMinorUnits / 100,
      currency: account.currency,
      institution: account.institution,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));
    
    // Calculate totals by currency
    const totalsByCurrency = {};
    accounts.forEach(account => {
      if (!totalsByCurrency[account.currency]) {
        totalsByCurrency[account.currency] = 0;
      }
      totalsByCurrency[account.currency] += account.balanceInMinorUnits / 100;
    });
    
    res.json({
      accounts: formattedAccounts,
      summary: {
        total: accounts.length,
        active: accounts.filter(a => a.isActive).length,
        totalsByCurrency
      }
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts' 
    });
  }
});

/**
 * @route   GET /api/accounts/:id
 * @desc    Get single account with recent transactions
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        error: 'Invalid account ID' 
      });
    }
    
    // Find account
    const account = await Account.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({
      account: id,
      user: req.userId
    })
      .sort({ date: -1 })
      .limit(10);
    
    // Calculate statistics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          account: new mongoose.Types.ObjectId(id),
          user: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amountInMinorUnits' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format statistics
    const stats = {
      income: 0,
      expenses: 0,
      transactionCount: 0
    };
    
    monthlyStats.forEach(stat => {
      if (stat._id === 'income') {
        stats.income = stat.total / 100;
      } else if (stat._id === 'expense') {
        stats.expenses = stat.total / 100;
      }
      stats.transactionCount += stat.count;
    });
    
    res.json({
      account: {
        _id: account._id,
        name: account.name,
        type: account.type,
        balance: account.balanceInMinorUnits / 100,
        currency: account.currency,
        institution: account.institution,
        isActive: account.isActive,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      },
      recentTransactions: recentTransactions.map(tx => ({
        _id: tx._id,
        type: tx.type,
        category: tx.category,
        amount: tx.amountInMinorUnits / 100,
        currency: tx.currency,
        description: tx.description,
        date: tx.date
      })),
      monthlyStats: stats
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ 
      error: 'Failed to fetch account details' 
    });
  }
});

/**
 * @route   POST /api/accounts
 * @desc    Create new account
 * @access  Private
 */
router.post('/', auth, accountValidation.create, async (req, res) => {
  try {
    const { name, type, balance = 0, currency = 'USD', institution } = req.body;
    
    // Check for duplicate account name for this user
    const existingAccount = await Account.findOne({
      user: req.userId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingAccount) {
      return res.status(400).json({ 
        error: 'An account with this name already exists' 
      });
    }
    
    // Create account
    const account = new Account({
      user: req.userId,
      name,
      type,
      balanceInMinorUnits: Math.round(balance * 100),
      currency,
      institution: institution || ''
    });
    
    await account.save();
    
    res.status(201).json({
      message: 'Account created successfully',
      account: {
        _id: account._id,
        name: account.name,
        type: account.type,
        balance: account.balanceInMinorUnits / 100,
        currency: account.currency,
        institution: account.institution,
        isActive: account.isActive,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ 
      error: 'Failed to create account' 
    });
  }
});

/**
 * @route   PUT /api/accounts/:id
 * @desc    Update account
 * @access  Private
 */
router.put('/:id', auth, accountValidation.update, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const updates = req.body;
      
      // Find account
      const account = await Account.findOne({
        _id: id,
        user: req.userId
      }).session(session);
      
      if (!account) {
        throw new Error('Account not found');
      }
      
      // Handle balance adjustment if provided
      if (updates.balance !== undefined) {
        const newBalanceInMinorUnits = Math.round(updates.balance * 100);
        const balanceDifference = newBalanceInMinorUnits - account.balanceInMinorUnits;
        
        if (balanceDifference !== 0) {
          // Create an adjustment transaction
          const adjustmentType = balanceDifference > 0 ? 'income' : 'expense';
          const adjustmentAmount = Math.abs(balanceDifference);
          
          const adjustmentTransaction = new Transaction({
            user: req.userId,
            account: account._id,
            type: adjustmentType,
            category: 'Balance Adjustment',
            amountInMinorUnits: adjustmentAmount,
            currency: account.currency,
            exchangeRateToUSD: 1, // Will be calculated properly in production
            amountInUSDMinorUnits: adjustmentAmount, // Simplified for now
            description: 'Manual balance adjustment',
            date: new Date()
          });
          
          await adjustmentTransaction.save({ session });
          account.balanceInMinorUnits = newBalanceInMinorUnits;
        }
      }
      
      // Update other fields
      if (updates.name) account.name = updates.name;
      if (updates.type) account.type = updates.type;
      if (updates.currency) account.currency = updates.currency;
      if (updates.institution !== undefined) account.institution = updates.institution;
      if (updates.isActive !== undefined) account.isActive = updates.isActive;
      
      await account.save({ session });
      
      res.json({
        message: 'Account updated successfully',
        account: {
          _id: account._id,
          name: account.name,
          type: account.type,
          balance: account.balanceInMinorUnits / 100,
          currency: account.currency,
          institution: account.institution,
          isActive: account.isActive,
          updatedAt: account.updatedAt
        }
      });
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to update account' 
    });
  } finally {
    await session.endSession();
  }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Delete account (soft delete)
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { forceDelete } = req.query;
      
      const account = await Account.findOne({
        _id: id,
        user: req.userId
      }).session(session);
      
      if (!account) {
        throw new Error('Account not found');
      }
      
      // Check for existing transactions
      const transactionCount = await Transaction.countDocuments({
        account: id,
        user: req.userId
      }).session(session);
      
      if (transactionCount > 0 && forceDelete !== 'true') {
        // Soft delete - just deactivate
        account.isActive = false;
        await account.save({ session });
        
        res.json({
          message: 'Account deactivated successfully',
          account: {
            _id: account._id,
            name: account.name,
            isActive: account.isActive
          }
        });
      } else if (forceDelete === 'true') {
        // Hard delete - remove account and all transactions
        await Transaction.deleteMany({
          account: id,
          user: req.userId
        }).session(session);
        
        await account.deleteOne({ session });
        
        res.json({
          message: 'Account and all related transactions deleted permanently',
          deletedTransactions: transactionCount
        });
      } else {
        // No transactions, safe to delete
        await account.deleteOne({ session });
        
        res.json({
          message: 'Account deleted successfully'
        });
      }
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to delete account' 
    });
  } finally {
    await session.endSession();
  }
});

/**
 * @route   POST /api/accounts/:id/reactivate
 * @desc    Reactivate a deactivated account
 * @access  Private
 */
router.post('/:id/reactivate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await Account.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }
    
    if (account.isActive) {
      return res.status(400).json({ 
        error: 'Account is already active' 
      });
    }
    
    account.isActive = true;
    await account.save();
    
    res.json({
      message: 'Account reactivated successfully',
      account: {
        _id: account._id,
        name: account.name,
        type: account.type,
        balance: account.balanceInMinorUnits / 100,
        currency: account.currency,
        isActive: account.isActive
      }
    });
  } catch (error) {
    console.error('Error reactivating account:', error);
    res.status(500).json({ 
      error: 'Failed to reactivate account' 
    });
  }
});

/**
 * @route   GET /api/accounts/:id/export
 * @desc    Export account transactions
 * @access  Private
 */
router.get('/:id/export', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json', startDate, endDate } = req.query;
    
    // Verify account ownership
    const account = await Account.findOne({
      _id: id,
      user: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }
    
    // Build query for transactions
    const query = {
      account: id,
      user: req.userId
    };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const transactions = await Transaction.find(query)
      .sort({ date: -1 });
    
    // Format transactions for export
    const exportData = transactions.map(tx => ({
      date: tx.date.toISOString().split('T')[0],
      type: tx.type,
      category: tx.category,
      amount: tx.amountInMinorUnits / 100,
      currency: tx.currency,
      description: tx.description
    }));
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Date,Type,Category,Amount,Currency,Description',
        ...exportData.map(row => 
          `${row.date},${row.type},${row.category},${row.amount},${row.currency},"${row.description}"`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${account.name}-transactions.csv"`);
      res.send(csv);
    } else {
      // JSON format
      res.json({
        account: {
          name: account.name,
          type: account.type,
          currency: account.currency
        },
        transactions: exportData,
        metadata: {
          exported: new Date().toISOString(),
          totalTransactions: exportData.length,
          dateRange: {
            start: startDate || 'all',
            end: endDate || 'all'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error exporting account data:', error);
    res.status(500).json({ 
      error: 'Failed to export account data' 
    });
  }
});

module.exports = router;