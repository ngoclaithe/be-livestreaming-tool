const { PaymentAccessCode, User, AccessCode } = require('../models');
const { generateRandomCode } = require('../utils/helpers');
const { Op } = require('sequelize');

// Tạo yêu cầu kích hoạt code thanh toán mới
exports.createPaymentRequest = async (req, res) => {
  try {
    const { accessCode, bankAccountNumber, bankName, amount, transactionNote } = req.body;
    const userId = req.user.id;

    // Kiểm tra access code có tồn tại và chưa được sử dụng
    const codeExists = await AccessCode.findOne({
      where: { 
        code: accessCode,
        status: 'active'
      }
    });

    if (!codeExists) {
      return res.status(400).json({ 
        success: false,
        message: 'Mã truy cập không hợp lệ hoặc đã được sử dụng' 
      });
    }

    // Tạo yêu cầu thanh toán mới
    const paymentRequest = await PaymentAccessCode.create({
      accessCode,
      code_pay: generateRandomCode(6, true),
      bankAccountNumber,
      bankName,
      amount,
      transactionNote,
      userId,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      data: paymentRequest,
      message: 'Tạo yêu cầu thanh toán thành công'
    });
  } catch (error) {
    console.error('Lỗi khi tạo yêu cầu thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo yêu cầu thanh toán',
      error: error.message
    });
  }
};

// Lấy danh sách yêu cầu thanh toán (cho admin)
exports.getAllPaymentRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await PaymentAccessCode.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'username'] },
        { model: User, as: 'canceller', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách yêu cầu thanh toán',
      error: error.message
    });
  }
};

// Lấy chi tiết yêu cầu thanh toán
exports.getPaymentRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentRequest = await PaymentAccessCode.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'username'] },
        { model: User, as: 'canceller', attributes: ['id', 'username'] },
        { 
          model: AccessCode, 
          as: 'accessCodeInfo',
          attributes: ['id', 'code', 'status', 'expiresAt']
        }
      ]
    });

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu thanh toán'
      });
    }

    // Chỉ cho phép admin hoặc chính người tạo xem
    if (req.user.role !== 'admin' && paymentRequest.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem yêu cầu này'
      });
    }

    res.json({
      success: true,
      data: paymentRequest
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết yêu cầu thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy chi tiết yêu cầu thanh toán',
      error: error.message
    });
  }
};

// Admin duyệt yêu cầu thanh toán
exports.approvePaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const paymentRequest = await PaymentAccessCode.findByPk(id, {
      include: [
        { model: AccessCode, as: 'accessCodeInfo' },
        { model: User, as: 'user' }
      ]
    });

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu thanh toán'
      });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu này đã được xử lý trước đó'
      });
    }

    // Thực hiện duyệt yêu cầu
    await paymentRequest.approve(adminId);

    // Cập nhật trạng thái access code
    if (paymentRequest.accessCodeInfo) {
      await paymentRequest.accessCodeInfo.update({ status: 'active' });
    }

    res.json({
      success: true,
      message: 'Đã duyệt yêu cầu thanh toán thành công',
      data: paymentRequest
    });
  } catch (error) {
    console.error('Lỗi khi duyệt yêu cầu thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi duyệt yêu cầu thanh toán',
      error: error.message
    });
  }
};

// Hủy yêu cầu thanh toán
exports.cancelPaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const paymentRequest = await PaymentAccessCode.findByPk(id);

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu thanh toán'
      });
    }

    // Chỉ cho phép admin hoặc chính người tạo hủy
    if (req.user.role !== 'admin' && paymentRequest.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy yêu cầu này'
      });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy yêu cầu đã được xử lý'
      });
    }

    // Thực hiện hủy yêu cầu
    const cancelledBy = req.user.role === 'admin' ? userId : null;
    await paymentRequest.cancel(cancelledBy, reason || 'Yêu cầu đã bị hủy');

    res.json({
      success: true,
      message: 'Đã hủy yêu cầu thanh toán thành công'
    });
  } catch (error) {
    console.error('Lỗi khi hủy yêu cầu thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi hủy yêu cầu thanh toán',
      error: error.message
    });
  }
};

// Lấy lịch sử yêu cầu thanh toán của người dùng
exports.getUserPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await PaymentAccessCode.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: User, as: 'approver', attributes: ['id', 'username'] },
        { model: User, as: 'canceller', attributes: ['id', 'username'] },
        { 
          model: AccessCode, 
          as: 'accessCodeInfo',
          attributes: ['id', 'code', 'status']
        }
      ]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử thanh toán:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy lịch sử thanh toán',
      error: error.message
    });
  }
};
