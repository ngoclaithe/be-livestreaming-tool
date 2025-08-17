const WebSocketService = require('../services/websocket.service');

// Tạo một lớp lỗi đơn giản nếu không sử dụng ErrorResponse
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @desc    Lấy trạng thái socket hiện tại
 * @route   GET /api/v1/socket/status
 * @access  Private/Admin
 */
exports.getSocketStatus = async (req, res, next) => {
  try {
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new AppError('WebSocket service is not available', 503);
    }
    
    const status = webSocketService.getHealthStatus();
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Lấy danh sách các phòng đang hoạt động
 * @route   GET /api/v1/socket/rooms
 * @access  Private/Admin
 */
exports.getActiveRooms = async (req, res, next) => {
  try {
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new AppError('WebSocket service is not available', 503);
    }
    
    const rooms = webSocketService.getAllRooms ? webSocketService.getAllRooms() : [];
    
    res.status(200).json({
      success: true,
      count: Array.isArray(rooms) ? rooms.length : 0,
      data: rooms || []
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Lấy thông tin chi tiết về một phòng
 * @route   GET /api/v1/socket/rooms/:accessCode
 * @access  Private/Admin
 */
exports.getRoomInfo = async (req, res, next) => {
  try {
    const { accessCode } = req.params;
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new AppError('WebSocket service is not available', 503);
    }
    
    const room = webSocketService.getRoom ? webSocketService.getRoom(accessCode) : null;
    
    if (!room) {
      throw new AppError(`Room with access code ${accessCode} not found`, 404);
    }
    
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (err) {
    next(err);
  }
};
