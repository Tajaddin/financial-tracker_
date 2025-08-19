// backend/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

/**
 * Standard validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

/**
 * Sanitize and validate date input
 */
const validateDate = (fieldName) => {
  return body(fieldName)
    .optional()
    .isISO8601()
    .toDate()
    .withMessage(`${fieldName} must be a valid ISO 8601 date`)
    .custom((value) => {
      // Ensure date is not too far in the future (e.g., max 10 years)
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 10);
      if (value > maxDate) {
        throw new Error(`${fieldName} cannot be more than 10 years in the future`);
      }
      return true;
    });
};

/**
 * Validate currency code
 */
const validateCurrency = (fieldName = 'currency') => {
  return body(fieldName)
    .optional()
    .isIn(['USD', 'EUR', 'AZN'])
    .withMessage('Currency must be USD, EUR, or AZN');
};

/**
 * Validate amount (ensures positive number)
 */
const validateAmount = (fieldName = 'amount') => {
  return body(fieldName)
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number')
    .custom((value) => {
      // Check for reasonable maximum (e.g., 1 billion)
      if (value > 1000000000) {
        throw new Error('Amount exceeds maximum allowed value');
      }
      // Check for too many decimal places
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        throw new Error('Amount cannot have more than 2 decimal places');
      }
      return true;
    });
};

/**
 * Validate MongoDB ObjectId
 */
const validateMongoId = (fieldName) => {
  return param(fieldName)
    .isMongoId()
    .withMessage(`Invalid ${fieldName}`);
};

/**
 * Transaction validation rules
 */
const transactionValidation = {
  create: [
    body('accountId').isMongoId().withMessage('Invalid account ID'),
    body('type').isIn(['income', 'expense', 'transfer']).withMessage('Invalid transaction type'),
    body('category')
      .notEmpty().withMessage('Category is required')
      .trim()
      .isLength({ min: 1, max: 50 }).withMessage('Category must be between 1 and 50 characters'),
    validateAmount('amount'),
    validateCurrency(),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    validateDate('date'),
    handleValidationErrors
  ],
  
  update: [
    validateMongoId('id'),
    body('type').optional().isIn(['income', 'expense', 'transfer']),
    body('category').optional().trim().isLength({ min: 1, max: 50 }),
    validateAmount('amount').optional(),
    validateCurrency().optional(),
    body('description').optional().trim().isLength({ max: 500 }),
    validateDate('date').optional(),
    handleValidationErrors
  ],
  
  delete: [
    validateMongoId('id'),
    handleValidationErrors
  ],
  
  query: [
    query('accountId').optional().isMongoId(),
    query('type').optional().isIn(['income', 'expense', 'transfer']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    handleValidationErrors
  ]
};

/**
 * Account validation rules
 */
const accountValidation = {
  create: [
    body('name')
      .notEmpty().withMessage('Account name is required')
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('type')
      .isIn(['checking', 'savings', 'credit', 'investment', 'cash'])
      .withMessage('Invalid account type'),
    body('balance')
      .optional()
      .isFloat()
      .withMessage('Balance must be a number'),
    validateCurrency(),
    body('institution')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Institution name cannot exceed 100 characters'),
    body('accountNumber')
      .optional()
      .trim()
      .matches(/^[A-Za-z0-9-]*$/).withMessage('Account number can only contain letters, numbers, and hyphens')
      .isLength({ max: 50 }).withMessage('Account number cannot exceed 50 characters'),
    handleValidationErrors
  ],
  
  update: [
    validateMongoId('id'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('type').optional().isIn(['checking', 'savings', 'credit', 'investment', 'cash']),
    body('balance').optional().isFloat(),
    validateCurrency().optional(),
    body('institution').optional().trim().isLength({ max: 100 }),
    body('accountNumber').optional().trim().matches(/^[A-Za-z0-9-]*$/).isLength({ max: 50 }),
    body('isActive').optional().isBoolean(),
    handleValidationErrors
  ]
};

/**
 * Borrowing validation rules
 */
const borrowingValidation = {
  create: [
    body('type').isIn(['borrowed', 'lent']).withMessage('Type must be borrowed or lent'),
    body('counterparty')
      .notEmpty().withMessage('Counterparty is required')
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Counterparty must be between 1 and 100 characters'),
    validateAmount('amount'),
    validateCurrency(),
    body('description').optional().trim().isLength({ max: 500 }),
    validateDate('date'),
    validateDate('dueDate').optional(),
    handleValidationErrors
  ],
  
  update: [
    validateMongoId('id'),
    body('status').optional().isIn(['pending', 'partially_paid', 'paid', 'overdue']),
    body('paidAmount').optional().isFloat({ min: 0 }),
    validateDate('dueDate').optional(),
    body('description').optional().trim().isLength({ max: 500 }),
    handleValidationErrors
  ]
};

/**
 * User validation rules
 */
const userValidation = {
  register: [
    body('email')
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    handleValidationErrors
  ],
  
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  validateDate,
  validateCurrency,
  validateAmount,
  validateMongoId,
  transactionValidation,
  accountValidation,
  borrowingValidation,
  userValidation
};