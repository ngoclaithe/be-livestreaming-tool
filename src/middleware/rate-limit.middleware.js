const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

// Store for rate limit counters
const rateLimitStore = new Map();

// Custom store for rate limiting with Redis
const createRedisRateLimitStore = (windowMs) => {
  return {
    // Method to increment the request count for a given key
    increment: async (key, callback) => {
      try {
        const redisClient = getRedisClient();
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Add current timestamp to the sorted set
        await redisClient.zAdd(`rate-limit:${key}`, [
          { score: now, value: now.toString() }
        ]);
        
        // Remove old timestamps outside the current window
        await redisClient.zRemRangeByScore(`rate-limit:${key}`, 0, windowStart);
        
        // Get the count of requests in the current window
        const requestCount = await redisClient.zCard(`rate-limit:${key}`);
        
        // Set TTL for the key to automatically clean up
        await redisClient.expire(`rate-limit:${key}`, Math.ceil(windowMs / 1000));
        
        callback(null, {
          current: requestCount,
          resetTime: new Date(now + windowMs)
        });
      } catch (error) {
        logger.error(`Redis rate limit error: ${error.message}`);
        callback(error);
      }
    }
  };
};

/**
 * Create a rate limiter with the given options
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests allowed in the window
 * @param {string} options.message - Error message when rate limit is exceeded
 * @param {boolean} options.standardHeaders - Whether to include rate limit headers
 * @param {boolean} options.legacyHeaders - Whether to include legacy rate limit headers
 * @param {string} options.keyPrefix - Prefix for rate limit keys
 * @returns {Function} Express middleware function
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100, // Limit each IP to 100 requests per windowMs
  message = 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau',
  standardHeaders = true,
  legacyHeaders = false,
  keyPrefix = 'rl_',
  skip = () => false, // Function to skip rate limiting
  keyGenerator = (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
  },
  skipFailedRequests = false, // Skip counting failed requests (status >= 400)
  skipSuccessfulRequests = false, // Skip counting successful requests (status < 400)
  store = createRedisRateLimitStore(windowMs) // Use Redis store by default
} = {}) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders,
    legacyHeaders,
    keyGenerator,
    skip,
    skipFailedRequests,
    skipSuccessfulRequests,
    store,
    handler: (req, res, next, options) => {
      const error = new ApiError(
        options.message.message || 'Quá nhiều yêu cầu',
        StatusCodes.TOO_MANY_REQUESTS
      );
      next(error);
    }
  });
};

// Pre-configured rate limiters
const rateLimiters = {
  // Strict rate limiting for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút',
    keyPrefix: 'auth_',
    skipFailedRequests: false
  }),

  // Standard API rate limiting
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút'
  }),

  // Public API with higher limits
  publicApi: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // Limit each IP to 1000 requests per hour
    message: 'Đã vượt quá giới hạn yêu cầu, vui lòng thử lại sau 1 giờ'
  }),

  // Strict rate limiting for sensitive operations
  sensitive: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per hour
    message: 'Quá nhiều yêu cầu thay đổi thông tin nhạy cảm, vui lòng thử lại sau 1 giờ'
  })
};

module.exports = {
  createRateLimiter,
  rateLimiters,
  rateLimitStore
};
