const { validationResult, matchedData } = require('express-validator');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Middleware xử lý kết quả validate từ express-validator
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Thực hiện tất cả các validation
    await Promise.all(validations.map(validation => validation.run(req)));

    // Lấy kết quả validate
    const errors = validationResult(req);
    
    // Nếu không có lỗi, gán dữ liệu đã được validate vào req.validatedData
    if (errors.isEmpty()) {
      req.validatedData = matchedData(req, { includeOptionals: true });
      return next();
    }

    // Nếu có lỗi, trả về lỗi 400 với thông tin chi tiết
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }));

    next(
      new ApiError(
        'Dữ liệu không hợp lệ',
        StatusCodes.BAD_REQUEST,
        extractedErrors
      )
    );
  };
};

// Các rule validate chung
const commonRules = {
  email: {
    isEmail: {
      errorMessage: 'Email không hợp lệ',
    },
    normalizeEmail: true,
  },
  password: {
    isLength: {
      options: { min: 8 },
      errorMessage: 'Mật khẩu phải có ít nhất 8 ký tự',
    },
    matches: {
      options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt',
    },
  },
  objectId: {
    isMongoId: {
      errorMessage: 'ID không hợp lệ',
    },
  },
  phone: {
    isMobilePhone: {
      options: ['vi-VN'],
      errorMessage: 'Số điện thoại không hợp lệ',
    },
  },
};

// Tạo các rule validate từ schema
const createValidationRules = (schema) => {
  const rules = [];
  
  for (const [field, rule] of Object.entries(schema)) {
    const { method, ...options } = rule;
    const validation = [];
    
    // Thêm các rule validate
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'object' && value !== null) {
        validation.push([key, value]);
      } else {
        validation.push([key, { errorMessage: value }]);
      }
    }
    
    // Thêm rule vào mảng rules
    rules.push([field, ...validation]);
  }
  
  return rules;
};

// Middleware kiểm tra định dạng file ảnh
const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(
      new ApiError('Chỉ chấp nhận file ảnh', StatusCodes.BAD_REQUEST),
      false
    );
  }
  cb(null, true);
};

// Middleware kiểm tra kích thước file
const checkFileSize = (maxSizeInMB) => (req, file, cb) => {
  const maxSize = maxSizeInMB * 1024 * 1024; // Chuyển đổi sang bytes
  
  if (file.size > maxSize) {
    return cb(
      new ApiError(
        `Kích thước file vượt quá giới hạn cho phép (${maxSizeInMB}MB)`,
        StatusCodes.BAD_REQUEST
      ),
      false
    );
  }
  
  cb(null, true);
};

module.exports = {
  validate,
  commonRules,
  createValidationRules,
  imageFileFilter,
  checkFileSize,
};
