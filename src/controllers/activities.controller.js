const { User, AccessCode, PaymentAccessCode } = require('../models');

// @desc    Lấy danh sách hoạt động
// @route   GET /api/v1/activities
// @access  Private/Admin
exports.getActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      raw: true
    }).then(users => users.map(user => ({
      ...user,
      type: 'user',
      action: 'create_user',
      createdAt: user.createdAt
    })));

    const accessCodes = await AccessCode.findAll({
      attributes: ['id', 'code', 'status', 'createdAt', 'createdBy'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      raw: true,
      nest: true
    }).then(codes => codes.map(code => ({
      id: code.id,
      type: 'access_code',
      action: 'create_access_code',
      code: code.code,
      status: code.status,
      createdBy: code.creator,
      createdAt: code.createdAt
    })));

    const paymentRequests = await PaymentAccessCode.findAll({
      attributes: ['id', 'code_pay', 'status', 'amount', 'created_at', 'user_id'],
      include: [{
        model: User,
        as: 'owner', // ✅ Sử dụng alias 'owner' thay vì 'requester'
        attributes: ['id', 'name', 'email'],
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      raw: true,
      nest: true,
      subQuery: false,
      includeIgnoreAttributes: false
    }).then(requests => requests.map(req => ({
      id: req.id,
      type: 'payment_request',
      action: 'create_payment_request',
      code: req.code_pay,
      status: req.status,
      amount: req.amount,
      user: req.owner, // ✅ Cập nhật tên field
      createdAt: req.created_at
    })));

    let allActivities = [...users, ...accessCodes, ...paymentRequests];
    allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    allActivities = allActivities.slice(0, limit);

    return res.status(200).json({
      success: true,
      count: allActivities.length,
      data: allActivities
    });
  } catch (error) {
    console.error('Error getting activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách hoạt động',
      error: error.message
    });
  }
};