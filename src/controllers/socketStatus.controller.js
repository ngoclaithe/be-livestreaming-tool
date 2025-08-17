const WebSocketService = require('../services/websocket.service');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

/**
 * @desc    Lấy trạng thái socket hiện tại
 * @route   GET /api/v1/socket/status
 * @access  Private/Admin
 */
exports.getSocketStatus = asyncHandler(async (req, res, next) => {
  // Lấy instance của WebSocketService
  const webSocketService = req.app.get('webSocketService');
  
  if (!webSocketService) {
    return next(new ErrorResponse('WebSocket service is not available', 503));
  }
  
  // Lấy thông tin trạng thái từ WebSocketService
  const status = webSocketService.getHealthStatus();
  
  res.status(200).json({
    success: true,
    data: status
  });
});

/**
 * @desc    Lấy danh sách các phòng đang hoạt động
 * @route   GET /api/v1/socket/rooms
 * @access  Private/Admin
 */
exports.getActiveRooms = asyncHandler(async (req, res, next) => {
  const webSocketService = req.app.get('webSocketService');
  
  if (!webSocketService) {
    return next(new ErrorResponse('WebSocket service is not available', 503));
  }
  
  // Lấy danh sách phòng đang hoạt động
  const rooms = webSocketService.getAllRooms ? webSocketService.getAllRooms() : [];
  
  res.status(200).json({
    success: true,
    count: Array.isArray(rooms) ? rooms.length : 0,
    data: rooms || []
  });
});

/**
 * @desc    Lấy thông tin chi tiết về một phòng
 * @route   GET /api/v1/socket/rooms/:accessCode
 * @access  Private/Admin
 */
exports.getRoomInfo = asyncHandler(async (req, res, next) => {
  const { accessCode } = req.params;
  const webSocketService = req.app.get('webSocketService');
  
  if (!webSocketService) {
    return next(new ErrorResponse('WebSocket service is not available', 503));
  }
  
  // Lấy thông tin phòng
  const room = webSocketService.getRoom ? webSocketService.getRoom(accessCode) : null;
  
  if (!room) {
    return next(new ErrorResponse(`Room with access code ${accessCode} not found`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: room
  });
});
