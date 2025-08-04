const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/matches
 * @desc    Lấy danh sách các trận đấu (có phân trang và lọc)
 * @access  Public
 * @query   {string} [status] - Lọc theo trạng thái (scheduled, in_progress, finished, postponed, cancelled)
 * @query   {string} [dateFrom] - Lọc từ ngày (YYYY-MM-DD)
 * @query   {string} [dateTo] - Lọc đến ngày (YYYY-MM-DD)
 * @query   {string} [teamName] - Tìm kiếm theo tên đội (nhà hoặc khách)
 * @query   {string} [tournament] - Lọc theo giải đấu
 * @query   {number} [page=1] - Số trang hiện tại
 * @query   {number} [limit=10] - Số lượng kết quả mỗi trang
 */
router.get('/', matchController.getMatches);

/**
 * @route   GET /api/v1/matches/:id
 * @desc    Lấy thông tin chi tiết một trận đấu
 * @access  Public
 * @param   {string} id - ID của trận đấu
 */
router.get('/:id', matchController.getMatch);

/**
 * @route   GET /api/v1/matches/access-code/:code
 * @desc    Lấy thông tin trận đấu bằng mã truy cập
 * @access  Public
 * @param   {string} code - Mã truy cập
 */
router.get('/access-code/:code', matchController.getMatchByAccessCode);

// Các route yêu cầu xác thực
router.use(protect);

/**
 * @route   POST /api/v1/matches
 * @desc    Tạo mới một trận đấu
 * @access  Private
 * @body    {string} matchName - Tên trận đấu
 * @body    {string} homeTeam - Tên đội nhà
 * @body    {string} awayTeam - Tên đội khách
 * @body    {string} homeTeamLogo - URL logo đội nhà
 * @body    {string} awayTeamLogo - URL logo đội khách
 * @body    {string} tournamentName - Tên giải đấu
 * @body    {string} [tournamentLogo] - URL logo giải đấu
 * @body    {string} matchDate - Ngày giờ thi đấu (ISO string)
 * @body    {string} [venue] - Địa điểm thi đấu
 * @body    {string} [status=scheduled] - Trạng thái trận đấu (scheduled, in_progress, finished, postponed, cancelled)
 */
router.post('/', matchController.createMatch);

/**
 * @route   PUT /api/v1/matches/:id
 * @desc    Cập nhật thông tin trận đấu
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} id - ID của trận đấu cần cập nhật
 * @body    {object} - Các trường cần cập nhật
 */
router.put('/:id', matchController.updateMatch);

/**
 * @route   DELETE /api/v1/matches/:id
 * @desc    Xóa một trận đấu
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} id - ID của trận đấu cần xóa
 */
router.delete('/:id', matchController.deleteMatch);

/**
 * @route   PUT /api/v1/matches/:id/stats
 * @desc    Cập nhật thống kê trận đấu
 * @access  Private (chủ sở hữu hoặc admin)
 * @param   {string} id - ID của trận đấu
 * @body    {number} [homeScore] - Tỷ số đội nhà
 * @body    {number} [awayScore] - Tỷ số đội khách
 * @body    {number} [possessionHome] - % kiểm soát bóng đội nhà
 * @body    {number} [possessionAway] - % kiểm soát bóng đội khách
 * @body    {number} [shotsHome] - Số cú sút đội nhà
 * @body    {number} [shotsAway] - Số cú sút đội khách
 * @body    {number} [shotsOnTargetHome] - Số cú sút trúng đích đội nhà
 * @body    {number} [shotsOnTargetAway] - Số cú sút trúng đích đội khách
 * @body    {number} [cornersHome] - Số phạt góc đội nhà
 * @body    {number} [cornersAway] - Số phạt góc đội khách
 * @body    {number} [foulsHome] - Số lần phạm lỗi đội nhà
 * @body    {number} [foulsAway] - Số lần phạm lỗi đội khách
 * @body    {number} [offsidesHome] - Số lần việt vị đội nhà
 * @body    {number} [offsidesAway] - Số lần việt vị đội khách
 * @body    {number} [yellowCardsHome] - Số thẻ vàng đội nhà
 * @body    {number} [yellowCardsAway] - Số thẻ vàng đội khách
 * @body    {number} [redCardsHome] - Số thẻ đỏ đội nhà
 * @body    {number} [redCardsAway] - Số thẻ đỏ đội khách
 */
router.put('/:id/stats', matchController.updateMatchStats);

module.exports = router;
