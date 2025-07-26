const { getRedisClient } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

// Thời gian sống mặc định của cache (giây)
const DEFAULT_CACHE_TTL = 300; // 5 phút

/**
 * Middleware cache response
 * @param {string} key - Khóa cache (có thể là function nhận req làm tham số)
 * @param {number} ttl - Thời gian sống của cache (giây)
 * @returns {Function} Middleware function
 */
const cacheResponse = (key, ttl = DEFAULT_CACHE_TTL) => {
  return async (req, res, next) => {
    try {
      const redisClient = getRedisClient();
      
      // Tạo khóa cache nếu là function
      const cacheKey = typeof key === 'function' ? key(req) : key;
      
      // Kiểm tra cache
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.status(StatusCodes.OK).json(JSON.parse(cachedData));
      }
      
      // Lưu lại hàm gốc của res.json để ghi đè
      const originalJson = res.json;
      
      // Ghi đè hàm res.json để lưu response vào cache
      res.json = (body) => {
        // Chỉ cache response thành công (status 200-299)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseData = JSON.stringify(body);
          
          // Lưu vào cache với thời gian sống
          redisClient.setEx(cacheKey, ttl, responseData)
            .catch(err => {
              logger.error(`Lỗi khi lưu cache: ${err.message}`);
            });
        }
        
        // Gọi hàm gốc
        originalJson.call(res, body);
      };
      
      next();
    } catch (error) {
      logger.error(`Lỗi xử lý cache: ${error.message}`);
      next(); // Tiếp tục xử lý dù có lỗi cache
    }
  };
};

/**
 * Xóa cache theo khóa
 * @param {string|string[]} keys - Khóa cache hoặc mảng các khóa cần xóa
 */
const clearCache = async (keys) => {
  try {
    const redisClient = getRedisClient();
    const keysToDelete = Array.isArray(keys) ? keys : [keys];
    
    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
      logger.debug(`Đã xóa cache cho các khóa: ${keysToDelete.join(', ')}`);
    }
  } catch (error) {
    logger.error(`Lỗi khi xóa cache: ${error.message}`);
    throw error;
  }
};

/**
 * Middleware xóa cache sau khi thay đổi dữ liệu
 * @param {string|string[]|Function} keys - Khóa cache hoặc function trả về khóa/mảng khóa
 */
const clearCacheAfter = (keys) => {
  return async (req, res, next) => {
    // Lưu lại hàm gốc của res.json
    const originalJson = res.json;
    
    // Ghi đè hàm res.json để xóa cache sau khi response
    res.json = async (body) => {
      try {
        // Xác định các khóa cần xóa
        let keysToClear = [];
        
        if (typeof keys === 'function') {
          const result = keys(req);
          keysToClear = Array.isArray(result) ? result : [result];
        } else {
          keysToClear = Array.isArray(keys) ? keys : [keys];
        }
        
        // Lọc bỏ các khóa không hợp lệ
        keysToClear = keysToClear.filter(k => k && typeof k === 'string');
        
        // Xóa cache nếu có khóa hợp lệ
        if (keysToClear.length > 0) {
          await clearCache(keysToClear);
        }
      } catch (error) {
        logger.error(`Lỗi khi xử lý xóa cache: ${error.message}`);
      }
      
      // Gọi hàm gốc
      originalJson.call(res, body);
    };
    
    next();
  };
};

module.exports = {
  cacheResponse,
  clearCache,
  clearCacheAfter,
  DEFAULT_CACHE_TTL,
};
