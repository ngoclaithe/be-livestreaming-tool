const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const config = require('../config');

// Danh sách các endpoint không cần ghi log lỗi
const noLogEndpoints = ['/health', '/favicon.ico'];

/**
 * Middleware xử lý lỗi toàn cục
 */
const errorHandler = (err, req, res, next) => {
  // Kiểm tra nếu response đã được gửi
  if (res.headersSent) {
    return next(err);
  }

  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Ghi log lỗi nếu không nằm trong danh sách bỏ qua
  if (!noLogEndpoints.includes(req.originalUrl.split('?')[0])) {
    logger.error({
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user ? req.user.id : 'unauthenticated',
      body: config.nodeEnv === 'development' ? req.body : {},
      query: config.nodeEnv === 'development' ? req.query : {},
      params: config.nodeEnv === 'development' ? req.params : {},
      headers: config.nodeEnv === 'development' ? req.headers : {}
    });
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Token không hợp lệ', StatusCodes.UNAUTHORIZED);
  }

  // Token hết hạn
  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token đã hết hạn, vui lòng đăng nhập lại', StatusCodes.UNAUTHORIZED);
  }

  // Lỗi yêu cầu quá nhiều
  if (err.statusCode === 429) {
    error = new ApiError('Quá nhiều yêu cầu, vui lòng thử lại sau', StatusCodes.TOO_MANY_REQUESTS);
  }

  // Lỗi multer (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError('File quá lớn, vui lòng chọn file nhỏ hơn', StatusCodes.BAD_REQUEST);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ApiError('Định dạng file không được hỗ trợ', StatusCodes.BAD_REQUEST);
  }

  // Xây dựng phản hồi lỗi
  const response = {
    success: false,
    message: error.message || 'Đã xảy ra lỗi máy chủ',
    ...(config.nodeEnv === 'development' && { stack: error.stack }),
    ...(error.errors && { errors: error.errors })
  };

  // Gửi phản hồi lỗi (chỉ gửi một lần)
  return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};

/**
 * Middleware xử lý 404 Not Found
 */
const notFound = (req, res, next) => {
  if (res.headersSent) {
    return;
  }
  const error = new ApiError(
    `Không tìm thấy tài nguyên: ${req.method} ${req.originalUrl}`,
    StatusCodes.NOT_FOUND
  );
  next(error);
};

/**
 * Middleware bắt các promise bị từ chối
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};

module.exports = {
  errorHandler,
  notFound,
  catchAsync
};