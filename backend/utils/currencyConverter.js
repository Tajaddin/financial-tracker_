const convertToUSD = (amount, currency) => {
  const rates = {
    USD: 1,
    AZN: 1.7015,
    EUR: 0.92, // Update this rate as needed
  };

  if (!rates[currency]) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  return amount / rates[currency];
};

module.exports = { convertToUSD };