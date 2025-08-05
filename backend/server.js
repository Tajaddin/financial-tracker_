const path = require('path');
const fs = require('fs');  // Added for file checks
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Debug: Current directory and .env path
const envPath = path.resolve(__dirname, '.env');
console.log('Current directory:', __dirname);
console.log('Looking for .env at:', envPath);

// Check if .env file exists
if (fs.existsSync(envPath)) {
  console.log('.env file FOUND');
  // Load environment variables
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env:', result.error);
  } else {
    console.log('.env loaded successfully');
  }
} else {
  console.error('ERROR: .env file NOT FOUND at', envPath);
}

// Debug: Show loaded environment variables
console.log('Environment Variables:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '*** loaded ***' : '!! NOT FOUND !!');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '*** loaded ***' : '!! NOT FOUND !!');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/borrowings', require('./routes/borrowings'));
app.use('/api/work-schedule', require('./routes/workSchedule'));

// MongoDB connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.error('Skipping MongoDB connection - MONGODB_URI missing');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});