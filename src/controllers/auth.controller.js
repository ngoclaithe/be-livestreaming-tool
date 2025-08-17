const User = require('../models/User');
const { getRedisClient } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize'); 

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });

    // Create token
    const token = user.getSignedJwtToken();

    res.status(StatusCodes.CREATED).json({
      success: true,
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

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new ApiError('Vui lòng nhập email và mật khẩu', StatusCodes.BAD_REQUEST)
      );
    }

    const user = await User.findOne({
      where: { email },
      attributes: { include: ['password'] }     });

    if (!user) {
      return next(
        new ApiError('Thông tin đăng nhập không chính xác', StatusCodes.UNAUTHORIZED)
      );
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(
        new ApiError('Thông tin đăng nhập không chính xác', StatusCodes.UNAUTHORIZED)
      );
    }

    if (!user.is_active) {
      return next(
        new ApiError('Tài khoản của bạn đã bị khóa', StatusCodes.FORBIDDEN)
      );
    }

    // Create token
    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
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

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { 
        id: req.user.id,
        is_active: true
      }
    });
    
    if (!user) {
      return next(
        new ApiError('Không tìm thấy người dùng hoặc tài khoản đã bị khóa', StatusCodes.NOT_FOUND)
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
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

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email
    };

    // Sử dụng Sequelize syntax
    const [updatedRowsCount] = await User.update(fieldsToUpdate, {
      where: { id: req.user.id },
      returning: true // PostgreSQL only, for other DB use separate findOne
    });

    // Lấy user đã update
    const user = await User.findOne({
      where: { id: req.user.id }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Update details error: ${error.message}`);
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    // Sử dụng Sequelize syntax để lấy user với password
    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: { include: ['password'] }
    });

    if (!user) {
      return next(
        new ApiError('Không tìm thấy người dùng', StatusCodes.NOT_FOUND)
      );
    }

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return next(
        new ApiError('Mật khẩu hiện tại không đúng', StatusCodes.UNAUTHORIZED)
      );
    }

    // Update password
    user.password = req.body.newPassword;
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
      token,
      user: {
        id: user.id, // Sử dụng user.id thay vì user._id
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

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ 
      where: { email: req.body.email } // Sử dụng Sequelize syntax
    });

    if (!user) {
      return next(
        new ApiError('Không tìm thấy người dùng với email này', StatusCodes.NOT_FOUND)
      );
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validate: false }); // Sequelize syntax

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/auth/resetpassword/${resetToken}`;

    // TODO: Send email with reset URL
    console.log(`Reset Password URL: ${resetUrl}`);

    res.status(StatusCodes.OK).json({
      success: true,
      data: 'Email đặt lại mật khẩu đã được gửi'
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

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    // Sử dụng Sequelize syntax với Op.gt
    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return next(new ApiError('Token không hợp lệ hoặc đã hết hạn', StatusCodes.BAD_REQUEST));
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(StatusCodes.OK).json({
      success: true,
      token,
      user: {
        id: user.id, // Sử dụng user.id thay vì user._id
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

// @desc    Logout user / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Add token to blacklist
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
      data: {}
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};