const User = require('../models/User');
const { getRedisClient } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const validatePassword = (password) => {
  const errors = [];
  if (!password) {
    errors.push('Mật khẩu là bắt buộc');
  } else {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (password.length > 128) {
      errors.push('Mật khẩu không được vượt quá 128 ký tự');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái thường');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái hoa');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
    if (!/(?=.*[!@#$%^&*])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)');
    }
  }
  return errors;
};

const validateEmail = (email) => {
  const errors = [];
  if (!email) {
    errors.push('Email là bắt buộc');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Email không hợp lệ');
    }
  }
  return errors;
};

const validateName = (name) => {
  const errors = [];
  if (!name) {
    errors.push('Tên là bắt buộc');
  } else {
    if (name.trim().length < 2) {
      errors.push('Tên phải có ít nhất 2 ký tự');
    }
    if (name.trim().length > 50) {
      errors.push('Tên không được vượt quá 50 ký tự');
    }
  }
  return errors;
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const validationErrors = [];
    
    validationErrors.push(...validateName(name));
    validationErrors.push(...validateEmail(email));
    validationErrors.push(...validatePassword(password));

    if (email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        validationErrors.push('Email này đã được sử dụng');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ',
        errors: validationErrors
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role: role || 'user'
    });

    const token = user.getSignedJwtToken();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Đăng ký thành công',
      token,
      user: {
        id: user.id, 
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const validationErrors = [];
    
    if (!email) {
      validationErrors.push('Email là bắt buộc');
    }
    if (!password) {
      validationErrors.push('Mật khẩu là bắt buộc');
    }

    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Thông tin đăng nhập không đầy đủ',
        errors: validationErrors
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      attributes: { include: ['password'] }
    });

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Thông tin đăng nhập không chính xác',
        errors: ['Email hoặc mật khẩu không đúng']
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Thông tin đăng nhập không chính xác',
        errors: ['Email hoặc mật khẩu không đúng']
      });
    }

    if (!user.is_active) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Tài khoản bị khóa',
        errors: ['Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên']
      });
    }

    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id, 
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { 
        id: req.user.id,
        is_active: true
      }
    });
    
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Không tìm thấy thông tin người dùng',
        errors: ['Không tìm thấy người dùng hoặc tài khoản đã bị khóa']
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Lấy thông tin người dùng thành công',
      data: {
        id: user.id, 
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        is_active: user.is_active
      }
    });
  } catch (error) {
    logger.error(`Get me error: ${error.message}`);
    next(error);
  }
};

exports.updateDetails = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    
    const validationErrors = [];
    
    if (name !== undefined) {
      validationErrors.push(...validateName(name));
    }
    
    if (email !== undefined) {
      validationErrors.push(...validateEmail(email));
      
      const existingUser = await User.findOne({ 
        where: { 
          email: email.toLowerCase(),
          id: { [Op.ne]: req.user.id }
        }
      });
      if (existingUser) {
        validationErrors.push('Email này đã được sử dụng bởi người dùng khác');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Dữ liệu cập nhật không hợp lệ',
        errors: validationErrors
      });
    }

    const fieldsToUpdate = {};
    if (name !== undefined) fieldsToUpdate.name = name.trim();
    if (email !== undefined) fieldsToUpdate.email = email.toLowerCase();

    await User.update(fieldsToUpdate, {
      where: { id: req.user.id }
    });

    const user = await User.findOne({
      where: { id: req.user.id }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: user
    });
  } catch (error) {
    logger.error(`Update details error: ${error.message}`);
    next(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const validationErrors = [];
    
    if (!currentPassword) {
      validationErrors.push('Mật khẩu hiện tại là bắt buộc');
    }
    
    validationErrors.push(...validatePassword(newPassword));

    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Dữ liệu thay đổi mật khẩu không hợp lệ',
        errors: validationErrors
      });
    }

    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: { include: ['password'] }
    });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Không tìm thấy người dùng',
        errors: ['Không tìm thấy thông tin người dùng']
      });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Mật khẩu hiện tại không đúng',
        errors: ['Mật khẩu hiện tại không chính xác']
      });
    }

    user.password = newPassword;
    await user.save();

    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Thay đổi mật khẩu thành công',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error(`Update password error: ${error.message}`);
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const validationErrors = validateEmail(email);
    
    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Email không hợp lệ',
        errors: validationErrors
      });
    }

    const user = await User.findOne({ 
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Không tìm thấy người dùng',
        errors: ['Không tìm thấy người dùng với email này']
      });
    }

    const resetToken = user.getResetPasswordToken();

    await user.save({ validate: false });

    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/auth/resetpassword/${resetToken}`;

    console.log(`Reset Password URL: ${resetUrl}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email đặt lại mật khẩu đã được gửi thành công',
      data: 'Vui lòng kiểm tra email để đặt lại mật khẩu'
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validate: false });
    }
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    
    const validationErrors = validatePassword(password);
    
    if (validationErrors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Mật khẩu mới không hợp lệ',
        errors: validationErrors
      });
    }

    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Token không hợp lệ',
        errors: ['Token không hợp lệ hoặc đã hết hạn']
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const redisClient = getRedisClient();
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const expiration = Math.floor(decoded.exp - Date.now() / 1000);
      
      if (expiration > 0) {
        await redisClient.set(`bl_${decoded.id}`, token, {
          EX: expiration
        });
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đăng xuất thành công',
      data: {}
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};