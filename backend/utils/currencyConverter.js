// backend/utils/currencyConverter.js
const EXCHANGE_RATES = {
  USD: 1,
  AZN: 1.7015,  // 1 USD = 1.7015 AZN, so 1 AZN = 0.588 USD
  EUR: 0.92,    // Update as needed
};

const convertToUSD = (amount, fromCurrency) => {
  if (!amount || !fromCurrency) return 0;
  
  // If already USD, return as is
  if (fromCurrency === 'USD') return amount;
  
  // Convert from other currency to USD
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) {
    console.error(`Unknown currency: ${fromCurrency}`);
    return amount;
  }
  
  // Convert: amount in foreign currency / rate = USD
  return amount / rate;
};

const convertFromUSD = (amountUSD, toCurrency) => {
  if (!amountUSD || !toCurrency) return 0;
  
  const rate = EXCHANGE_RATES[toCurrency];
  if (!rate) {
    console.error(`Unknown currency: ${toCurrency}`);
    return amountUSD;
  }
  
  // Convert: USD * rate = foreign currency
  return amountUSD * rate;
};

module.exports = {
  EXCHANGE_RATES,
  convertToUSD,
  convertFromUSD,
};
