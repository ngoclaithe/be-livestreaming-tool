const { User, AccessCode, PaymentAccessCode, Activity } = require('../models');

// @desc    Lấy danh sách hoạt động
// @route   GET /api/v1/activities
// @access  Private
exports.getActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const limit = 50; // Giới hạn 50 bản ghi mới nhất

    if (!Activity) {
      throw new Error('Activity model is undefined');
    }

    const userCondition = isAdmin ? {} : { user_id: userId };
    const accessCodeCondition = isAdmin ? {} : { createdBy: userId };
    const paymentCondition = isAdmin ? {} : { user_id: userId };

    const activityLogs = await Activity.findAll({
      where: userCondition,
      order: [['created_at', 'DESC']],
      limit: isAdmin ? undefined : limit,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      raw: true,
      nest: true
    });

    const accessCodes = await AccessCode.findAll({
      where: accessCodeCondition,
      attributes: ['id', 'code', 'status', 'createdAt', 'expiredAt', 'createdBy'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: isAdmin ? undefined : limit,
      raw: true,
      nest: true
    });

    const paymentRequests = await PaymentAccessCode.findAll({
      where: paymentCondition,
      attributes: [
        'id', 
        'code_pay',
        'status', 
        'amount', 
        'created_at',
        'updated_at',
        'user_id'
      ], 
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email']
      }],
      order: [['created_at', 'DESC']],
      limit: isAdmin ? undefined : limit,
      raw: true,
      nest: true
    });

    const formatActivityLogs = activityLogs.map(log => ({
      id: log.id,
      type: log.entity_type,
      action: log.action,
      description: log.details,
      metadata: log.details,
      user: log.user,
      createdAt: log.created_at
    }));

    const formatAccessCodes = accessCodes.map(code => ({
      id: code.id,
      type: 'access_code',
      action: 'create_access_code',
      code: code.code,
      status: code.status,
      expiredAt: code.expiredAt,
      createdBy: code.creator,
      createdAt: code.createdAt
    }));

    const formatPaymentRequests = paymentRequests.map(req => ({
      id: req.id,
      type: 'payment_request',
      action: req.status === 'pending' ? 'create_payment_request' : `payment_${req.status}`,
      code: req.code_pay,
      status: req.status,
      amount: req.amount,
      user: req.owner,
      createdAt: req.created_at,
      updatedAt: req.updated_at
    }));

    let allActivities = [
      ...formatActivityLogs,
      ...formatAccessCodes,
      ...formatPaymentRequests
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); 

    if (!isAdmin) {
      allActivities = allActivities.slice(0, limit);
    }

    return res.status(200).json({
      success: true,
      count: allActivities.length,
      data: allActivities
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách hoạt động',
      error: error.message
    });
  }
};
