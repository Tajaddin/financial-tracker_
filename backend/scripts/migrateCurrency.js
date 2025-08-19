// backend/scripts/migrateCurrency.js
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Borrowing = require('../models/Borrowing');
const { convertToUSD } = require('../utils/currencyConverter');
require('dotenv').config();

async function migrateCurrencyData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // 1. Update accounts without currency
    const accountsWithoutCurrency = await Account.find({ currency: { $exists: false } });
    console.log(`Found ${accountsWithoutCurrency.length} accounts without currency`);
    
    for (const account of accountsWithoutCurrency) {
      account.currency = 'USD'; // Default to USD
      await account.save();
      console.log(`Updated account: ${account.name}`);
    }
    
    // 2. Update transactions
    const transactions = await Transaction.find({ 
      $or: [
        { currency: { $exists: false } },
        { amountInUSD: { $exists: false } }
      ]
    }).populate('account');
    
    console.log(`Found ${transactions.length} transactions to update`);
    
    for (const transaction of transactions) {
      if (!transaction.currency && transaction.account) {
        transaction.currency = transaction.account.currency || 'USD';
      }
      
      if (!transaction.amountInUSD) {
        transaction.amountInUSD = convertToUSD(transaction.amount, transaction.currency);
      }
      
      await transaction.save();
    }
    
    // 3. Update borrowings
    const borrowings = await Borrowing.find({ currency: { $exists: false } });
    console.log(`Found ${borrowings.length} borrowings to update`);
    
    for (const borrowing of borrowings) {
      borrowing.currency = 'USD'; // Default to USD
      await borrowing.save();
    }
    
    console.log('Migration completed successfully!');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run: node scripts/migrateCurrency.js
migrateCurrencyData();