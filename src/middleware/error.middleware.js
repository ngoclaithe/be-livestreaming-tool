const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const config = require('../config');

const noLogEndpoints = ['/health', '/favicon.ico'];

const setCorsHeaders = (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin, X-CSRF-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  setCorsHeaders(req, res);

  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

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

  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Token không hợp lệ', StatusCodes.UNAUTHORIZED);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token đã hết hạn, vui lòng đăng nhập lại', StatusCodes.UNAUTHORIZED);
  }

  if (err.statusCode === 429) {
    error = new ApiError('Quá nhiều yêu cầu, vui lòng thử lại sau', StatusCodes.TOO_MANY_REQUESTS);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError('File quá lớn, vui lòng chọn file nhỏ hơn', StatusCodes.BAD_REQUEST);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ApiError('Định dạng file không được hỗ trợ', StatusCodes.BAD_REQUEST);
  }

  const response = {
    success: false,
    message: error.message || 'Đã xảy ra lỗi máy chủ',
    ...(config.nodeEnv === 'development' && { stack: error.stack }),
    ...(error.errors && { errors: error.errors })
  };

  return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};

const notFound = (req, res, next) => {
  if (res.headersSent) {
    return;
  }
  
  setCorsHeaders(req, res);
  
  const error = new ApiError(
    `Không tìm thấy tài nguyên: ${req.method} ${req.originalUrl}`,
    StatusCodes.NOT_FOUND
  );
  next(error);
};

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};

module.exports = {
  errorHandler,
  notFound,
  catchAsync
};