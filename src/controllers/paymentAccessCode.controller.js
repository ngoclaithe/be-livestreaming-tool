const PaymentAccessCode = require('../models/PaymentAccessCode');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const InfoPayment = require('../models/InfoPayment');

exports.createPaymentRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    
    const { accessCode, amount, transactionNote } = req.body;
    
    if (!accessCode || !amount) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Vui lòng cung cấp mã truy cập và số tiền', StatusCodes.BAD_REQUEST));
    }

    const existingAccessCode = await AccessCode.findOne({
      where: { code: accessCode }
    });

    if (!existingAccessCode) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Mã truy cập không tồn tại', StatusCodes.NOT_FOUND));
    }

    const paymentInfo = await InfoPayment.findOne({
      order: [['createdAt', 'ASC']] 
    }, { transaction: t });

    if (!paymentInfo) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Không tìm thấy thông tin thanh toán trong hệ thống', StatusCodes.NOT_FOUND));
    }
    const existingRequest = await PaymentAccessCode.findOne({
      where: {
        access_code: accessCode,
        status: 'pending'
      }
    });

    console.log(" Giá trị của existingRequest", existingRequest);

    if (existingRequest) {
      await t.rollback();
      responded = true;
      
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Yêu cầu thanh toán cho mã này đã tồn tại',
        data: {
          id: existingRequest.id,
          code_pay: existingRequest.code_pay,
          accessCode: existingRequest.access_code,
          accountNumber: existingRequest.bank_account_number,
          bank: existingRequest.bank_name,
          name: existingRequest.name || "",
          amount: existingRequest.amount,
          status: existingRequest.status,
          created_at: existingRequest.createdAt
        }
      });
    }

    const code_pay = await PaymentAccessCode.generatePaymentCode();

    if (!paymentInfo) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Không tìm thấy thông tin thanh toán', StatusCodes.NOT_FOUND));
    }

    const paymentRequest = await PaymentAccessCode.create({
      user_id: req.user.id,
      access_code: accessCode,
      code_pay: code_pay,
      bank_account_number: paymentInfo.accountNumber || '',
      bank_name: paymentInfo.bank || 'Ngân hàng chưa xác định',
      name: paymentInfo.name || 'Chủ tài khoản chưa xác định',
      amount: parseFloat(amount) || 0,
      transaction_note: transactionNote || '',
    }, { transaction: t });

    await t.commit();
    responded = true;

    console.log("Giá trị của payment request", paymentRequest);

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        id: paymentRequest.id,
        code_pay: paymentRequest.code_pay,
        accessCode: paymentRequest.access_code,
        accountNumber: paymentRequest.bank_account_number,
        bank: paymentRequest.bank_name,
        name: paymentRequest.name || "name",
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