const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

/**
 * Middleware bảo vệ route - yêu cầu xác thực
 * Kiểm tra và xác thực token JWT
 */
const protect = async (req, res, next) => {
  let token;
  
  // Lấy token từ header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Hoặc lấy token từ cookie
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  // Kiểm tra xem có token không
  if (!token) {
    return next(
      new ApiError('Bạn cần đăng nhập để truy cập tài nguyên này', StatusCodes.UNAUTHORIZED)
    );
  }

  try {
    // Xác minh token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Kiểm tra xem token có trong blacklist không (nếu sử dụng Redis)
    if (config.redis.enabled) {
      const redisClient = getRedisClient();
      const isBlacklisted = await redisClient.get(`bl_${decoded.id}`);
      
      if (isBlacklisted) {
        return next(
          new ApiError('Token đã hết hạn, vui lòng đăng nhập lại', StatusCodes.UNAUTHORIZED)
        );
      }
    }

    // Lấy thông tin người dùng từ cơ sở dữ liệu (chỉ lấy các trường cần thiết)
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'avatar', 'last_login', 'createdAt', 'updatedAt']
    });

    if (!user) {
      return next(
        new ApiError('Không tìm thấy người dùng với token này', StatusCodes.NOT_FOUND)
      );
    }

    // Kiểm tra xem tài khoản có bị khóa không
    // Sử dụng user.is_active thay vì user.isActive để phù hợp với tên trường trong model
    if (user.is_active === false) {
      return next(
        new ApiError('Tài khoản của bạn đã bị khóa', StatusCodes.FORBIDDEN)
      );
    }

    // Gắn thông tin người dùng vào request
    req.user = user;
    next();
  } catch (error) {
    logger.error(`Xác thực token thất bại: ${error.message}`);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError('Token không hợp lệ', StatusCodes.UNAUTHORIZED));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError('Token đã hết hạn, vui lòng đăng nhập lại', StatusCodes.UNAUTHORIZED));
    }
    
    next(error);
  }
};

/**
 * Phân quyền dựa trên vai trò
 * @param {...string} roles - Các vai trò được phép truy cập
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError('Vui lòng đăng nhập để tiếp tục', StatusCodes.UNAUTHORIZED)
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Vai trò ${req.user.role} không được phép truy cập tài nguyên này`,
          StatusCodes.FORBIDDEN
        )
      );
    }
    next();
  };
};

/**
 * Kiểm tra quyền sở hữu tài nguyên
 * @param {Model} model - Model của tài nguyên cần kiểm tra
 * @param {string} [paramName='id'] - Tên tham số chứa ID của tài nguyên
 * @param {string} [ownerField='userId'] - Trường xác định chủ sở hữu trong model
 */
const checkOwnership = (model, paramName = 'id', ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      const id = req.params[paramName];
      const resource = await model.findByPk(id);

      if (!resource) {
        return next(
          new ApiError(
            `Không tìm thấy tài nguyên với ID ${id}`,
            StatusCodes.NOT_FOUND
          )
        );
      }

      // Admin có quyền truy cập mọi thứ
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Kiểm tra quyền sở hữu
      const ownerId = resource[ownerField] || resource.userId;
      if (ownerId !== req.user.id) {
        return next(
          new ApiError(
            'Bạn không có quyền thực hiện hành động này',
            StatusCodes.FORBIDDEN
          )
        );
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware kiểm tra giới hạn tỷ lệ yêu cầu
 * @param {number} limit - Số lượng yêu cầu tối đa trong khoảng thời gian
 * @param {number} windowMs - Khoảng thời gian tính bằng mili giây
 */
const rateLimiter = (limit, windowMs) => {
  const requests = new Map();

  return (req, res, next) => {
    // Bỏ qua rate limiting cho môi trường test
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Lọc các yêu cầu cũ hơn windowMs
    const userRequests = (requests.get(ip) || []).filter(time => time > windowStart);

    if (userRequests.length >= limit) {
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000) // Thời gian chờ tính bằng giây
      });
    }

    userRequests.push(now);
    requests.set(ip, userRequests);
    
    // Thiết lập header RateLimit
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': limit - userRequests.length,
      'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
    });
    
    next();
  };
};

module.exports = { 
  protect, 
  authorize, 
  checkOwnership,
  rateLimiter
};
