const PaymentAccessCode = require('../models/PaymentAccessCode');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

exports.createPaymentRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    console.log('🔥 [PaymentAccessCode Controller] Create payment request started');
    
    const { accessCode, bankAccountNumber, bankName, amount, transactionNote } = req.body;
    
    if (!accessCode || !bankAccountNumber || !bankName || !amount) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Vui lòng cung cấp đầy đủ thông tin bắt buộc', StatusCodes.BAD_REQUEST));
    }

    const existingAccessCode = await AccessCode.findOne({
      where: { code: accessCode }
    });

    if (!existingAccessCode) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Mã truy cập không tồn tại', StatusCodes.NOT_FOUND));
    }

    const existingRequest = await PaymentAccessCode.findOne({
      where: {
        accessCode: accessCode,
        status: 'pending'
      }
    });

    if (existingRequest) {
      await t.rollback();
      responded = true;
      
      // Trả về thông tin yêu cầu thanh toán đã tồn tại
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Yêu cầu thanh toán cho mã này đã tồn tại',
        data: {
          id: existingRequest.id,
          code_pay: existingRequest.code_pay,
          accessCode: existingRequest.accessCode,
          bankAccountNumber: existingRequest.bankAccountNumber,
          bankName: existingRequest.bankName,
          amount: existingRequest.amount,
          status: existingRequest.status,
          created_at: existingRequest.createdAt
        }
      });
    }

    const code_pay = PaymentAccessCode.generatePaymentCode();

    const paymentRequest = await PaymentAccessCode.create({
      userId: req.user.id,
      accessCode,
      code_pay,
      bankAccountNumber,
      bankName,
      amount: parseFloat(amount),
      transactionNote
    }, { transaction: t });

    await t.commit();
    responded = true;

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        id: paymentRequest.id,
        code_pay: paymentRequest.code_pay,
        accessCode: paymentRequest.accessCode,
        bankAccountNumber: paymentRequest.bankAccountNumber,
        bankName: paymentRequest.bankName,
        amount: paymentRequest.amount,
        status: paymentRequest.status,
        created_at: paymentRequest.createdAt
      }
    });
  } catch (error) {
    if (!t.finished) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        logger.error(`Transaction rollback error: ${rollbackError.message}`);
      }
    } else {
      logger.warn('⚠️ Transaction already committed, skip rollback');
    }

    logger.error(`Create payment request error: ${error.message}`, {
      stack: error.stack,
      user_id: req.user?.id,
      access_code: req.body?.accessCode
    });

    if (!responded && !res.headersSent) {
      return next(error);
    }
  }
};

exports.getPaymentRequests = async (req, res, next) => {
  try {
    const { status, userId, accessCode, page = 1, limit = 10 } = req.query;
    const filter = {};
    
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    } else if (userId) {
      filter.userId = userId;
    }
    
    if (status) {
      filter.status = status;
    }

    if (accessCode) {
      filter.accessCode = {
        [Op.iLike]: `%${accessCode}%`
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows: paymentRequests } = await PaymentAccessCode.findAndCountAll({
      where: filter,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'canceller',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      count: paymentRequests.length,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit),
      data: paymentRequests
    });
  } catch (error) {
    logger.error(`Get payment requests error: ${error.message}`);
    return next(error);
  }
};

exports.getPaymentRequestByCode = async (req, res, next) => {
  try {
    const { code_pay } = req.params;
    
    if (!code_pay) {
      return next(new ApiError('Vui lòng cung cấp mã thanh toán', StatusCodes.BAD_REQUEST));
    }

    const paymentRequest = await PaymentAccessCode.findOne({
      where: { code_pay: code_pay.toUpperCase() },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    if (!paymentRequest) {
      logger.warn(`Payment request not found with code: ${code_pay}`);
      return next(new ApiError('Không tìm thấy yêu cầu thanh toán với mã đã cung cấp', StatusCodes.NOT_FOUND));
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: paymentRequest
    });
  } catch (error) {
    logger.error(`Get payment request by code error: ${error.message}`, { error });
    return next(error);
  }
};

exports.getPaymentRequest = async (req, res, next) => {
  try {
    const paymentRequest = await PaymentAccessCode.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'canceller',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (!paymentRequest) {
      return next(new ApiError('Không tìm thấy yêu cầu thanh toán', StatusCodes.NOT_FOUND));
    }

    if (req.user.role !== 'admin' && paymentRequest.userId !== req.user.id) {
      return next(new ApiError('Không có quyền truy cập yêu cầu này', StatusCodes.FORBIDDEN));
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: paymentRequest
    });
  } catch (error) {
    logger.error(`Get payment request error: ${error.message}`);
    return next(error);
  }
};

exports.approvePaymentRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      await t.rollback();
      return next(new ApiError('Chỉ admin mới có quyền duyệt yêu cầu', StatusCodes.FORBIDDEN));
    }

    const paymentRequest = await PaymentAccessCode.findByPk(id, { transaction: t });

    if (!paymentRequest) {
      await t.rollback();
      return next(new ApiError('Không tìm thấy yêu cầu thanh toán', StatusCodes.NOT_FOUND));
    }

    await paymentRequest.approve(req.user.id);
    await t.commit();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Yêu cầu thanh toán đã được duyệt thành công',
      data: paymentRequest
    });
  } catch (error) {
    await t.rollback();
    logger.error(`Approve payment request error: ${error.message}`);
    
    if (error.message.includes('Chỉ có thể duyệt')) {
      return next(new ApiError(error.message, StatusCodes.BAD_REQUEST));
    }
    
    return next(error);
  }
};

exports.cancelPaymentRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const paymentRequest = await PaymentAccessCode.findByPk(id, { transaction: t });

    if (!paymentRequest) {
      await t.rollback();
      return next(new ApiError('Không tìm thấy yêu cầu thanh toán', StatusCodes.NOT_FOUND));
    }

    if (req.user.role !== 'admin' && paymentRequest.userId !== req.user.id) {
      await t.rollback();
      return next(new ApiError('Không có quyền hủy yêu cầu này', StatusCodes.FORBIDDEN));
    }

    if (!reason) {
      await t.rollback();
      return next(new ApiError('Vui lòng cung cấp lý do hủy', StatusCodes.BAD_REQUEST));
    }

    await paymentRequest.cancel(req.user.id, reason);
    await t.commit();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Yêu cầu thanh toán đã được hủy',
      data: paymentRequest
    });
  } catch (error) {
    await t.rollback();
    logger.error(`Cancel payment request error: ${error.message}`);
    
    if (error.message.includes('Chỉ có thể hủy')) {
      return next(new ApiError(error.message, StatusCodes.BAD_REQUEST));
    }
    
    return next(error);
  }
};

exports.deletePaymentRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      await t.rollback();
      return next(new ApiError('Chỉ admin mới có quyền xóa yêu cầu', StatusCodes.FORBIDDEN));
    }

    const paymentRequest = await PaymentAccessCode.findByPk(id, { transaction: t });

    if (!paymentRequest) {
      await t.rollback();
      return next(new ApiError('Không tìm thấy yêu cầu thanh toán', StatusCodes.NOT_FOUND));
    }

    await paymentRequest.destroy({ transaction: t });
    await t.commit();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Yêu cầu thanh toán đã được xóa',
      data: {}
    });
  } catch (error) {
    await t.rollback();
    logger.error(`Delete payment request error: ${error.message}`);
    return next(error);
  }
};

exports.getPaymentStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return next(new ApiError('Chỉ admin mới có quyền xem thống kê', StatusCodes.FORBIDDEN));
    }

    const stats = await PaymentAccessCode.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['status'],
      raw: true
    });

    const totalRequests = await PaymentAccessCode.count();
    const totalAmount = await PaymentAccessCode.sum('amount');

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        total_requests: totalRequests,
        total_amount: totalAmount || 0,
        by_status: stats
      }
    });
  } catch (error) {
    logger.error(`Get payment stats error: ${error.message}`);
    return next(error);
  }
};

console.log('PaymentAccessCode Controller exports:', Object.keys(module.exports));