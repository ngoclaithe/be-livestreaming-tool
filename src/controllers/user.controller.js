const { Op } = require('sequelize');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

/**
 * @desc    Lấy danh sách người dùng (chỉ admin)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count
      }
    });
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Lấy thông tin người dùng bằng ID (chỉ admin)
 * @route   GET /api/v1/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          association: 'matches',
          attributes: ['id', 'matchName', 'teamA', 'teamB', 'matchDate', 'status']
        },
        {
          association: 'accessCodes',
          attributes: ['id', 'code', 'status', 'expiredAt', 'createdAt']
        },
        {
          association: 'logos',
          attributes: ['id', 'code_logo', 'type_logo', 'url_logo']
        }
      ]
    });

    if (!user) {
      return next(new ApiError(`Không tìm thấy người dùng với ID ${req.params.id}`, StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Cập nhật người dùng (chỉ admin)
 * @route   PUT /api/v1/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return next(new ApiError(`Không tìm thấy người dùng với ID ${req.params.id}`, StatusCodes.NOT_FOUND));
    }

    // Không cho phép cập nhật mật khẩu qua endpoint này
    if (req.body.password) {
      delete req.body.password;
    }

    await user.update(req.body);
    
    // Ẩn mật khẩu trước khi trả về
    user.password = undefined;

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Xóa người dùng (chỉ admin)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return next(new ApiError(`Không tìm thấy người dùng với ID ${req.params.id}`, StatusCodes.NOT_FOUND));
    }

    // Không cho phép xóa chính mình
    if (user.id === req.user.id) {
      return next(new ApiError('Không thể xóa tài khoản của chính bạn', StatusCodes.BAD_REQUEST));
    }

    await user.destroy();

    res.status(StatusCodes.OK).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    next(error);
  }
};
