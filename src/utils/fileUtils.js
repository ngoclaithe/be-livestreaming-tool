const fs = require('fs').promises;
const path = require('path');
const { fileURLToPath } = require('url');

/**
 * Lấy thông tin kích thước file
 * @param {string} filePath - Đường dẫn đến file
 * @returns {Promise<{size: number, sizeReadable: string}>} - Kích thước file (bytes) và dạng đọc được
 */
const getFileSize = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      sizeReadable: formatFileSize(stats.size)
    };
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return { size: 0, sizeReadable: '0 B' };
  }
};

/**
 * Định dạng kích thước file thành chuỗi dễ đọc
 * @param {number} bytes - Kích thước file tính bằng bytes
 * @returns {string} - Chuỗi đã định dạng (VD: "1.2 MB")
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Tính tỷ lệ sử dụng của logo dựa trên số lần request
 * @param {Date} lastRequested - Thời gian request cuối cùng
 * @param {Date} createdAt - Thời gian tạo
 * @param {number} requestCount - Tổng số lần request
 * @returns {string} - Mức độ sử dụng (high/medium/low)
 */
const getUsageLevel = (lastRequested, createdAt, requestCount) => {
  if (!lastRequested || !createdAt) return 'low';
  
  const now = new Date();
  const daysSinceLastRequest = (now - new Date(lastRequested)) / (1000 * 60 * 60 * 24);
  const daysSinceCreation = (now - new Date(createdAt)) / (1000 * 60 * 60 * 24);
  
  // Nếu ít hơn 10 request hoặc tạo dưới 7 ngày
  if (requestCount < 10 || daysSinceCreation < 7) {
    return 'low';
  }
  
  // Nếu request trong vòng 7 ngày qua
  if (daysSinceLastRequest <= 7) {
    return 'high';
  }
  
  // Nếu request trong vòng 30 ngày qua
  if (daysSinceLastRequest <= 30) {
    return 'medium';
  }
  
  return 'low';
};

module.exports = {
  getFileSize,
  formatFileSize,
  getUsageLevel
};
