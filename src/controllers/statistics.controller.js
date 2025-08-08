const { AccessCode, User, PaymentAccessCode, RoomSession } = require('../models');

/**
 * Get total number of access codes created
 * @route GET /api/v1/statistics/access-codes/count
 * @access Private/Admin
 */
const getTotalAccessCodes = async (req, res) => {
  try {
    const count = await AccessCode.count();
    res.status(200).json({
      success: true,
      data: {
        total: count
      }
    });
    console.log("Giá trị count là:", count);
  } catch (error) {
    console.error('Error getting total access codes:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tổng số mã truy cập',
      error: error.message
    });
  }
};

/**
 * Get total number of user accounts
 * @route GET /api/v1/statistics/users/count
 * @access Private/Admin
 */
const getTotalUsers = async (req, res) => {
  try {
    const count = await User.count();
    res.status(200).json({
      success: true,
      data: {
        total: count
      }
    });
  } catch (error) {
    console.error('Error getting total users:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tổng số tài khoản',
      error: error.message
    });
  }
};

/**
 * Get total number of code purchase requests
 * @route GET /api/v1/statistics/payment-requests/count
 * @access Private/Admin
 */
const getTotalPaymentRequests = async (req, res) => {
  try {
    const count = await PaymentAccessCode.count();
    res.status(200).json({
      success: true,
      data: {
        total: count
      }
    });
  } catch (error) {
    console.error('Error getting total payment requests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tổng số yêu cầu mua code',
      error: error.message
    });
  }
};

/**
 * Get number of active room sessions
 * @route GET /api/v1/statistics/room-sessions/active/count
 * @access Private/Admin
 */
const getActiveRoomSessionsCount = async (req, res) => {
  try {
    const count = await RoomSession.count({
      where: {
        status: 'active'
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        total: count
      }
    });
  } catch (error) {
    console.error('Error getting active room sessions count:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy số lượng phòng đang hoạt động',
      error: error.message
    });
  }
};

/**
 * Get all statistics in one request
 * @route GET /api/v1/statistics/summary
 * @access Private/Admin
 */
const getStatisticsSummary = async (req, res) => {
  try {
    const [
      totalAccessCodes,
      totalUsers,
      totalPaymentRequests,
      activeRoomSessions
    ] = await Promise.all([
      AccessCode.count(),
      User.count(),
      PaymentAccessCode.count(),
      RoomSession.count({ where: { status: 'active' } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAccessCodes,
        totalUsers,
        totalPaymentRequests,
        activeRoomSessions
      }
    });
  } catch (error) {
    console.error('Error getting statistics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê tổng hợp',
      error: error.message
    });
  }
};

module.exports = {
  getTotalAccessCodes,
  getTotalUsers,
  getTotalPaymentRequests,
  getActiveRoomSessionsCount,
  getStatisticsSummary
};
