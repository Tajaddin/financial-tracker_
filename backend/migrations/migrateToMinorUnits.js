// backend/migrations/migrateToMinorUnits.js
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Borrowing = require('../models/Borrowing');
const { getExchangeRateToUSD } = require('../utils/currencyConverter');

/**
 * Migration script to convert existing data to use minor units (cents)
 * and ensure all required fields are present
 */
async function migrateToMinorUnits() {
  try {
    console.log('Starting migration to minor units...');
    
    // Start a session for consistency
    const session = await mongoose.startSession();
    
    await session.withTransaction(async () => {
      // Migrate Accounts
      console.log('Migrating accounts...');
      const accounts = await Account.find({}).session(session);
      
      for (const account of accounts) {
        let needsUpdate = false;
        
        // Convert balance to minor units if needed
        if (account.balance !== undefined && account.balanceInMinorUnits === undefined) {
          account.balanceInMinorUnits = Math.round(account.balance * 100);
          account.balance = undefined; // Remove old field
          needsUpdate = true;
        }
        
        // Ensure currency is set
        if (!account.currency) {
          account.currency = 'USD'; // Default currency
          needsUpdate = true;
          console.log(`  Account ${account._id}: Set default currency to USD`);
        }
        
        if (needsUpdate) {
          await account.save({ session, validateBeforeSave: false });
          console.log(`  Account ${account._id}: Migrated`);
        }
      }
      
      // Migrate Transactions
      console.log('Migrating transactions...');
      const transactions = await Transaction.find({}).session(session);
      
      for (const transaction of transactions) {
        let needsUpdate = false;
        
        // Convert amount to minor units if needed
        if (transaction.amount !== undefined && transaction.amountInMinorUnits === undefined) {
          transaction.amountInMinorUnits = Math.round(transaction.amount * 100);
          transaction.amount = undefined; // Remove old field
          needsUpdate = true;
        }
        
        // Ensure currency is set
        if (!transaction.currency) {
          // Try to get currency from associated account
          const account = await Account.findById(transaction.account).session(session);
          transaction.currency = account?.currency || 'USD';
          needsUpdate = true;
          console.log(`  Transaction ${transaction._id}: Set currency to ${transaction.currency}`);
        }
        
        // Calculate exchange rate if missing
        if (!transaction.exchangeRateToUSD) {
          transaction.exchangeRateToUSD = getExchangeRateToUSD(
            transaction.currency, 
            transaction.date
          ) || 1;
          needsUpdate = true;
        }
        
        // Calculate USD amount if missing
        if (transaction.amountInUSD !== undefined && transaction.amountInUSDMinorUnits === undefined) {
          transaction.amountInUSDMinorUnits = Math.round(transaction.amountInUSD * 100);
          transaction.amountInUSD = undefined; // Remove old field
          needsUpdate = true;
        } else if (!transaction.amountInUSDMinorUnits) {
          // Calculate from amount and exchange rate
          const usdAmount = transaction.amountInMinorUnits / transaction.exchangeRateToUSD;
          transaction.amountInUSDMinorUnits = Math.round(usdAmount);
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await transaction.save({ session, validateBeforeSave: false });
          console.log(`  Transaction ${transaction._id}: Migrated`);
        }
      }
      
      // Migrate Borrowings
      console.log('Migrating borrowings...');
      const borrowings = await Borrowing.find({}).session(session);
      
      for (const borrowing of borrowings) {
        let needsUpdate = false;
        
        // Convert amount to minor units if needed
        if (borrowing.amount !== undefined && borrowing.amountInMinorUnits === undefined) {
          borrowing.amountInMinorUnits = Math.round(borrowing.amount * 100);
          borrowing.amount = undefined; // Remove old field
          needsUpdate = true;
        }
        
        // Convert paid amount to minor units if needed
        if (borrowing.paidAmount !== undefined && borrowing.paidAmountInMinorUnits === undefined) {
          borrowing.paidAmountInMinorUnits = Math.round(borrowing.paidAmount * 100);
          borrowing.paidAmount = undefined; // Remove old field
          needsUpdate = true;
        } else if (borrowing.paidAmountInMinorUnits === undefined) {
          borrowing.paidAmountInMinorUnits = 0;
          needsUpdate = true;
        }
        
        // Ensure currency is set (aligned with other models)
        if (!borrowing.currency || !['USD', 'EUR', 'AZN'].includes(borrowing.currency)) {
          console.log(`  Borrowing ${borrowing._id}: Invalid currency "${borrowing.currency}", setting to USD`);
          borrowing.currency = 'USD';
          needsUpdate = true;
        }
        
        // Calculate exchange rate if missing
        if (!borrowing.exchangeRateToUSD) {
          borrowing.exchangeRateToUSD = getExchangeRateToUSD(
            borrowing.currency,
            borrowing.date
          ) || 1;
          needsUpdate = true;
        }
        
        // Calculate USD amount if missing
        if (borrowing.amountInUSD !== undefined && borrowing.amountInUSDMinorUnits === undefined) {
          borrowing.amountInUSDMinorUnits = Math.round(borrowing.amountInUSD * 100);
          borrowing.amountInUSD = undefined; // Remove old field
          needsUpdate = true;
        } else if (!borrowing.amountInUSDMinorUnits) {
          const usdAmount = borrowing.amountInMinorUnits / borrowing.exchangeRateToUSD;
          borrowing.amountInUSDMinorUnits = Math.round(usdAmount);
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await borrowing.save({ session, validateBeforeSave: false });
          console.log(`  Borrowing ${borrowing._id}: Migrated`);
        }
      }
      
      console.log('Migration completed successfully!');
    });
    
    await session.endSession();
    
    // Verify migration
    console.log('\nVerifying migration...');
    
    const sampleAccount = await Account.findOne({});
    if (sampleAccount) {
      console.log('Sample Account:', {
        id: sampleAccount._id,
        balanceInMinorUnits: sampleAccount.balanceInMinorUnits,
        currency: sampleAccount.currency
      });
    }
    
    const sampleTransaction = await Transaction.findOne({});
    if (sampleTransaction) {
      console.log('Sample Transaction:', {
        id: sampleTransaction._id,
        amountInMinorUnits: sampleTransaction.amountInMinorUnits,
        currency: sampleTransaction.currency,
        exchangeRateToUSD: sampleTransaction.exchangeRateToUSD
      });
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial-tracker';
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
      return migrateToMinorUnits();
    })
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = migrateToMinorUnits;