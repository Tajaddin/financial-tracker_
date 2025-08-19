// backend/utils/currencyConverter.js

// FIXED: Store rates with dates for historical accuracy
// In production, these should come from a database or API
const exchangeRates = {
  // Current rates (as of the system date)
  current: {
    USD: 1.0,
    EUR: 0.92,
    AZN: 1.7015,
    lastUpdated: new Date('2025-08-19')
  },
  // Historical rates for migrations and reports
  // You should populate this from a rates API or database
  historical: [
    {
      date: new Date('2025-08-01'),
      rates: { USD: 1.0, EUR: 0.92, AZN: 1.7015 }
    },
    {
      date: new Date('2025-07-01'),
      rates: { USD: 1.0, EUR: 0.91, AZN: 1.70 }
    }
    // Add more historical rates as needed
  ]
};

/**
 * Get exchange rate for a specific date
 * @param {Date} date - The date for which to get the rate
 * @returns {Object} Exchange rates for that date
 */
function getRatesForDate(date) {
  if (!date || !(date instanceof Date)) {
    return exchangeRates.current.rates || exchangeRates.current;
  }
  
  // Find the closest historical rate
  const targetTime = date.getTime();
  let closestRate = exchangeRates.current;
  let closestDiff = Math.abs(targetTime - exchangeRates.current.lastUpdated.getTime());
  
  for (const historical of exchangeRates.historical) {
    const diff = Math.abs(targetTime - historical.date.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestRate = historical.rates;
    }
  }
  
  return closestRate;
}

/**
 * Convert amount from one currency to another using minor units
 * @param {number} amountInMinorUnits - Amount in minor units (cents)
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @param {Date} date - Date for exchange rate (optional)
 * @returns {Object} Converted amount and rate used
 */
function convertCurrency(amountInMinorUnits, fromCurrency, toCurrency, date = new Date()) {
  // Validate inputs
  if (!Number.isInteger(amountInMinorUnits)) {
    throw new Error('Amount must be an integer (in minor units)');
  }
  
  if (!fromCurrency || !toCurrency) {
    throw new Error('Both fromCurrency and toCurrency are required');
  }
  
  // Same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return {
      amountInMinorUnits: amountInMinorUnits,
      exchangeRate: 1,
      fromCurrency,
      toCurrency,
      date
    };
  }
  
  const rates = getRatesForDate(date);
  
  if (!rates[fromCurrency] || !rates[toCurrency]) {
    throw new Error(`Exchange rate not available for ${fromCurrency} or ${toCurrency}`);
  }
  
  // Convert to USD first (as base), then to target currency
  const amountInUSD = amountInMinorUnits / rates[fromCurrency];
  const convertedAmount = Math.round(amountInUSD * rates[toCurrency]);
  const exchangeRate = rates[toCurrency] / rates[fromCurrency];
  
  return {
    amountInMinorUnits: convertedAmount,
    exchangeRate,
    exchangeRateToUSD: rates[fromCurrency],
    fromCurrency,
    toCurrency,
    date
  };
}

/**
 * Convert to USD
 * @param {number} amountInMinorUnits - Amount in minor units
 * @param {string} fromCurrency - Source currency
 * @param {Date} date - Date for exchange rate
 * @returns {Object} USD amount and rate
 */
function convertToUSD(amountInMinorUnits, fromCurrency, date = new Date()) {
  return convertCurrency(amountInMinorUnits, fromCurrency, 'USD', date);
}

/**
 * Convert from USD
 * @param {number} amountInMinorUnits - Amount in USD minor units
 * @param {string} toCurrency - Target currency
 * @param {Date} date - Date for exchange rate
 * @returns {Object} Converted amount and rate
 */
function convertFromUSD(amountInMinorUnits, toCurrency, date = new Date()) {
  return convertCurrency(amountInMinorUnits, 'USD', toCurrency, date);
}

/**
 * Get current exchange rate to USD
 * @param {string} currency - Currency code
 * @returns {number} Exchange rate to USD
 */
function getExchangeRateToUSD(currency, date = new Date()) {
  const rates = getRatesForDate(date);
  return rates[currency] || null;
}

/**
 * Update exchange rates (should be called periodically)
 * In production, this would fetch from an API
 */
async function updateExchangeRates() {
  // Example: Fetch from a rates API
  // const response = await fetch('https://api.exchangeratesapi.io/latest?base=USD');
  // const data = await response.json();
  // exchangeRates.current = { ...data.rates, lastUpdated: new Date() };
  
  // For now, just log
  console.log('Exchange rates update scheduled - implement API integration');
}

module.exports = {
  convertCurrency,
  convertToUSD,
  convertFromUSD,
  getExchangeRateToUSD,
  updateExchangeRates,
  getRatesForDate
};