/**
 * Generates a random alphanumeric code of specified length
 * @param {number} length - Length of the code to generate
 * @param {boolean} [numbersOnly=true] - Whether to generate numbers only
 * @returns {string} - Generated code
 */
const generateRandomCode = (length = 6, numbersOnly = true) => {
  let result = '';
  let characters = '0123456789';
  
  if (!numbersOnly) {
    characters += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
};

/**
 * Formats a number to VND currency format
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
const formatCurrencyVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

function toDateInputFormat(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

module.exports = {
  generateRandomCode,
  formatCurrencyVND,
  toDateInputFormat
};
