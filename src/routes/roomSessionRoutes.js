const express = require('express');
const router = express.Router();
const {
    getAllRoomSessions,
    getRoomSessionById,
    getRoomSessionByAccessCode,
    getActiveRoomSessions
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

module.exports = router;
