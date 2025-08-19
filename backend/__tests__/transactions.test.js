// backend/__tests__/transactions.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');

let mongoServer;
let authToken;
let userId;
let accountId;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Disconnect from any existing connection
  await mongoose.disconnect();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri);
  
  // Create a test user
  const user = await User.create({
    email: 'test@example.com',
    password: 'Test123!',
    name: 'Test User'
  });
  userId = user._id;
  
  // Generate auth token
  authToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  // Create a test account
  const account = await Account.create({
    user: userId,
    name: 'Test Checking',
    type: 'checking',
    balanceInMinorUnits: 100000, // $1000.00
    currency: 'USD'
  });
  accountId = account._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear transactions before each test
  await Transaction.deleteMany({});
  
  // Reset account balance
  await Account.findByIdAndUpdate(accountId, {
    balanceInMinorUnits: 100000
  });
});

describe('Transaction Routes', () => {
  describe('POST /api/transactions', () => {
    test('should create income transaction and update balance', async () => {
      const transactionData = {
        accountId: accountId.toString(),
        type: 'income',
        category: 'Salary',
        amount: 500.50,
        currency: 'USD',
        description: 'Monthly salary',
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.amount).toBe(500.50);
      expect(response.body.updatedBalance).toBe(1500.50);
      
      // Verify database
      const account = await Account.findById(accountId);
      expect(account.balanceInMinorUnits).toBe(150050); // $1500.50
    });
    
    test('should create expense transaction and update balance', async () => {
      const transactionData = {
        accountId: accountId.toString(),
        type: 'expense',
        category: 'Groceries',
        amount: 75.25,
        currency: 'USD',
        description: 'Weekly groceries',
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(75.25);
      expect(response.body.updatedBalance).toBe(924.75);
      
      // Verify database
      const account = await Account.findById(accountId);
      expect(account.balanceInMinorUnits).toBe(92475); // $924.75
    });
    
    test('should handle cross-currency transactions', async () => {
      const transactionData = {
        accountId: accountId.toString(),
        type: 'expense',
        category: 'Travel',
        amount: 100,
        currency: 'EUR', // Different from account currency (USD)
        description: 'Hotel in Europe',
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(201);
      expect(response.body.currency).toBe('EUR');
      
      // Verify the balance was converted properly
      const account = await Account.findById(accountId);
      // EUR to USD conversion should have occurred
      expect(account.balanceInMinorUnits).toBeLessThan(100000);
    });
    
    test('should reject transaction for non-existent account', async () => {
      const fakeAccountId = new mongoose.Types.ObjectId();
      const transactionData = {
        accountId: fakeAccountId.toString(),
        type: 'income',
        category: 'Test',
        amount: 100,
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should prevent accessing other users accounts', async () => {
      // Create another user's account
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'Other123!',
        name: 'Other User'
      });
      
      const otherAccount = await Account.create({
        user: otherUser._id,
        name: 'Other Account',
        type: 'savings',
        balanceInMinorUnits: 50000,
        currency: 'USD'
      });
      
      const transactionData = {
        accountId: otherAccount._id.toString(),
        type: 'expense',
        category: 'Hack',
        amount: 1000,
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not found');
      
      // Verify other account wasn't touched
      const account = await Account.findById(otherAccount._id);
      expect(account.balanceInMinorUnits).toBe(50000);
    });
    
    test('should validate required fields', async () => {
      const invalidData = {
        accountId: accountId.toString(),
        // Missing type and category
        amount: 100
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
    
    test('should reject negative amounts', async () => {
      const transactionData = {
        accountId: accountId.toString(),
        type: 'income',
        category: 'Test',
        amount: -100,
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
    
    test('should prevent insufficient funds for non-credit accounts', async () => {
      const transactionData = {
        accountId: accountId.toString(),
        type: 'expense',
        category: 'Large Purchase',
        amount: 2000, // More than account balance
        currency: 'USD',
        date: '2025-08-19T10:00:00Z'
      };
      
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient funds');
    });
  });
  
  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      // Create some test transactions
      await Transaction.create([
        {
          user: userId,
          account: accountId,
          type: 'income',
          category: 'Salary',
          amountInMinorUnits: 200000,
          currency: 'USD',
          exchangeRateToUSD: 1,
          amountInUSDMinorUnits: 200000,
          date: new Date('2025-08-01')
        },
        {
          user: userId,
          account: accountId,
          type: 'expense',
          category: 'Food',
          amountInMinorUnits: 5000,
          currency: 'USD',
          exchangeRateToUSD: 1,
          amountInUSDMinorUnits: 5000,
          date: new Date('2025-08-15')
        }
      ]);
    });
    
    test('should fetch user transactions', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
    });
    
    test('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({
          startDate: '2025-08-10',
          endDate: '2025-08-20'
        })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].category).toBe('Food');
    });
    
    test('should filter by type', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({ type: 'income' })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].type).toBe('income');
    });
    
    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.pagination.pages).toBe(2);
    });
  });
  
  describe('DELETE /api/transactions/:id', () => {
    test('should delete transaction and restore balance', async () => {
      // Create a transaction
      const transaction = await Transaction.create({
        user: userId,
        account: accountId,
        type: 'expense',
        category: 'Test',
        amountInMinorUnits: 10000, // $100
        currency: 'USD',
        exchangeRateToUSD: 1,
        amountInUSDMinorUnits: 10000,
        date: new Date()
      });
      
      // Reduce account balance
      await Account.findByIdAndUpdate(accountId, {
        $inc: { balanceInMinorUnits: -10000 }
      });
      
      const response = await request(app)
        .delete(`/api/transactions/${transaction._id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
      expect(response.body.updatedBalance).toBe(1000); // Balance restored
      
      // Verify transaction is deleted
      const deletedTx = await Transaction.findById(transaction._id);
      expect(deletedTx).toBeNull();
    });
  });
});

describe('Currency Conversion', () => {
  test('should handle multi-currency conversions correctly', () => {
    const { convertCurrency } = require('../utils/currencyConverter');
    
    // Test USD to EUR
    const result = convertCurrency(10000, 'USD', 'EUR');
    expect(result.fromCurrency).toBe('USD');
    expect(result.toCurrency).toBe('EUR');
    expect(result.amountInMinorUnits).toBeGreaterThan(0);
    
    // Test same currency
    const sameResult = convertCurrency(10000, 'USD', 'USD');
    expect(sameResult.amountInMinorUnits).toBe(10000);
    expect(sameResult.exchangeRate).toBe(1);
  });
  
  test('should reject invalid amounts', () => {
    const { convertCurrency } = require('../utils/currencyConverter');
    
    expect(() => {
      convertCurrency(100.5, 'USD', 'EUR'); // Non-integer
    }).toThrow('must be an integer');
  });
});