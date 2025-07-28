const express = require('express');
const router = express.Router();
const accessCodeController = require('../controllers/accessCode.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const Match = require('../models/Match');
const AccessCode = require('../models/AccessCode');

// Middleware để kiểm tra quyền sở hữu match thông qua access code
const checkMatchOwnership = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Tìm access code và match liên quan
    const accessCode = await AccessCode.findOne({
      where: { code },
      include: [{
        model: Match,
        as: 'match'
      }]
    });
    
    if (!accessCode) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy access code'
      });
    }
    
    if (!accessCode.match) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin trận đấu'
      });
    }
    
    // Kiểm tra nếu người dùng là admin hoặc chủ sở hữu của access code
    if (req.user.role !== 'admin' && accessCode.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa trận đấu này'
      });
    }
    
    req.accessCode = accessCode;
    req.match = accessCode.match;
    next();
  } catch (error) {
    next(error);
  }
};

// Public route for verifying access code (no authentication required)
/**
 * @route   GET /api/v1/access-codes/:code/verify-login
 * @desc    Xác minh access code có hợp lệ không
 * @access  Public
 * @param   {string} code - Mã truy cập cần xác minh
 */
router.get('/:code/verify-login', accessCodeController.verifyAccessCode);

// Tất cả các route dưới đây đều yêu cầu xác thực
router.use(protect);

/**
 * @route   POST /api/v1/access-codes
 * @desc    Tạo mới access code
 * @access  Private
 * @body    {string} [matchId] - ID của trận đấu (nếu có)
 * @body    {string} [expiresAt] - Ngày hết hạn (ISO string)
 * @body    {number} [maxUses=1] - Số lần sử dụng tối đa
 * @body    {object} [metadata] - Thông tin bổ sung
 */
router.post('/', accessCodeController.createAccessCode);

/**
 * @route   GET /api/v1/access-codes
 * @desc    Lấy danh sách access codes
 * @access  Private
 * @query   {string} [status] - Lọc theo trạng thái (active, used, expired, revoked)
 * @query   {string} [matchId] - Lọc theo ID trận đấu
 * @query   {string} [createdBy] - Lọc theo người tạo
 * @query   {number} [page=1] - Số trang hiện tại
 * @query   {number} [limit=10] - Số lượng kết quả mỗi trang
 */
router.get('/', accessCodeController.getAccessCodes);

/**
 * @route   GET /api/v1/access-codes/:code
 * @desc    Lấy thông tin chi tiết access code
 * @access  Private
 * @param   {string} code - Mã truy cập
 */
router.get('/:code', accessCodeController.getAccessCode);

/**
 * @route   PUT /api/v1/access-codes/:id
 * @desc    Cập nhật access code
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} id - ID của access code cần cập nhật
 * @body    {string} [status] - Trạng thái mới
 * @body    {string} [expiresAt] - Ngày hết hạn mới (ISO string)
 * @body    {number} [maxUses] - Số lần sử dụng tối đa mới
 * @body    {object} [metadata] - Thông tin bổ sung
 */
router.put('/:id', accessCodeController.updateAccessCode);

/**
 * @route   DELETE /api/v1/access-codes/:id
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} id - ID của access code cần xóa
 */
router.delete('/:id', accessCodeController.deleteAccessCode);

/**
 * @route   PUT /api/v1/access-codes/:code/match
 * @desc    Cập nhật thông tin trận đấu của access code
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} code - Mã truy cập
 * @body    {string} [teamAName] - Tên đội A
 * @body    {string} [teamBName] - Tên đội B
 * @body    {string} [teamALogo] - URL logo đội A
 * @body    {string} [teamBLogo] - URL logo đội B
 * @body    {string} [tournamentName] - Tên giải đấu
 * @body    {string} [tournamentLogo] - URL logo giải đấu
 * @body    {string} [typeMatch] - Loại trận đấu (soccer, pickleball, other)
 * @body    {string} [matchDate] - Ngày giờ diễn ra trận đấu (ISO string)
 */
router.put(
  '/:code/match', 
  checkMatchOwnership,
  accessCodeController.updateMatchInfo
);

/**
 * @route   GET /api/v1/access-codes/:code/match
 * @desc    Lấy thông tin trận đấu của access code
 * @access  Private
 * @param   {string} code - Mã truy cập
 */
router.get(
  '/:code/match',
  accessCodeController.getMatchInfo
);

/**
 * @route   POST /api/v1/access-codes/:code/use
 * @desc    Sử dụng access code
 * @access  Private
 * @param   {string} code - Mã truy cập cần sử dụng
 */
router.post('/:code/use', accessCodeController.useAccessCode);

module.exports = router;