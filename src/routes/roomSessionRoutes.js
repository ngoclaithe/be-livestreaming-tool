const express = require('express');
const router = express.Router();
const {
    getAllRoomSessions,
    getRoomSessionById,
    getRoomSessionByAccessCode,
    getActiveRoomSessions,
    deleteRoom,
    disconnectClient,
    deleteExpiredRooms,
    debugRoomConnections,
    forceCleanupRoom,
    getHistoryMatches
} = require('../controllers/roomSessionController');

/**
 * @route   GET /api/room-sessions
 * @desc    Lấy tất cả các room sessions
 * @access  Public
 */
router.get('/', getAllRoomSessions);

/**
 * @route   GET /api/room-sessions/active
 * @desc    Lấy danh sách các room session đang hoạt động
 * @access  Public
 */
router.get('/active', getActiveRoomSessions);

/**
 * @route   GET /api/room-sessions/history
 * @desc    Lấy lịch sử 10 phòng đã hết hạn gần nhất kèm cấu hình hiển thị
 * @access  Public
 */
router.get('/history', getHistoryMatches);

/**
 * @route   GET /api/room-sessions/access-code/:code
 * @desc    Lấy thông tin room session theo access code
 * @access  Public
 */
router.get('/access-code/:code', getRoomSessionByAccessCode);

/**
 * @route   GET /api/room-sessions/:id
 * @desc    Lấy thông tin chi tiết một room session theo ID
 * @access  Public
 */
router.get('/:id', getRoomSessionById);

/**
 * @route   DELETE /api/room-sessions/:id
 * @desc    Xóa một phòng theo ID
 * @access  Private/Admin
 */
router.delete('/:id', deleteRoom);

/**
 * @route   POST /api/room-sessions/disconnect-client
 * @desc    Ngắt kết nối với client theo ID
 * @body    {string} clientId - ID của client cần ngắt kết nối
 * @access  Private/Admin
 */
router.post('/disconnect-client', disconnectClient);

/**
 * @route   DELETE /api/room-sessions/expired
 * @desc    Xóa tất cả các phòng đã hết hạn
 * @access  Private/Admin
 */
router.delete('/expired', deleteExpiredRooms);

/**
 * @route   GET /api/room-sessions/debug/:accessCode
 * @desc    Kiểm tra trạng thái kết nối của một phòng (dành cho debug)
 * @access  Private/Admin
 */
router.get('/debug/:accessCode', debugRoomConnections);

/**
 * @route   POST /api/room-sessions/force-cleanup/:accessCode
 * @desc    Dọn dẹp cưỡng chế một phòng (chỉ dùng khi cần thiết)
 * @access  Private/Admin
 */
router.post('/force-cleanup/:accessCode', forceCleanupRoom);

module.exports = router;
