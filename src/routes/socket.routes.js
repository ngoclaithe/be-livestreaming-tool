const express = require('express');
const router = express.Router();
const { 
  getSocketStatus, 
  getActiveRooms, 
  getRoomInfo 
} = require('../controllers/socketStatus.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Socket Status
 *   description: Quản lý trạng thái WebSocket (Admin only)
 */

// Tất cả các route đều yêu cầu xác thực và quyền admin
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/v1/socket/status
 * @desc    Lấy trạng thái tổng quan của WebSocket server
 * @access  Private/Admin
 * @returns {object} Thông tin trạng thái socket
 */
router.get('/status', getSocketStatus);

/**
 * @route   GET /api/v1/socket/rooms
 * @desc    Lấy danh sách các phòng đang hoạt động
 * @access  Private/Admin
 * @returns {Array} Danh sách các phòng đang hoạt động
 */
router.get('/rooms', getActiveRooms);

/**
 * @route   GET /api/v1/socket/rooms/:accessCode
 * @desc    Lấy thông tin chi tiết về một phòng
 * @access  Private/Admin
 * @param   {string} accessCode - Mã truy cập của phòng
 * @returns {object} Thông tin chi tiết về phòng
 */
router.get('/rooms/:accessCode', getRoomInfo);

module.exports = router;
