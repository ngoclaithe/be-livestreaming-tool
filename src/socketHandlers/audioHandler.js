const logger = require('../utils/logger');

/**
 * Xử lý các sự kiện liên quan đến bình luận âm thanh trực tiếp
 * @param {Socket} socket - Socket instance
 * @param {Object} webSocketService - WebSocketService instance
 */
const handleAudio = (socket, webSocketService) => {
  const { io } = webSocketService;
  
  // Xử lý bình luận âm thanh trực tiếp
  socket.on('commentary_audio', (data) => {
    if (!data.accessCode || !data.audioData) {
      logger.warn(`[Audio] Invalid commentary audio data from socket ${socket.id}`);
      return;
    }
    
    // Ghi log cho mục đích debug
    logger.info(`[Audio] Received commentary audio in room ${data.accessCode}, size: ${data.audioData.length} bytes`);
    
    // Broadcast đến tất cả client khác trong phòng
    socket.to(data.accessCode).emit('commentary_audio_received', {
      audioData: data.audioData,
      mimeType: data.mimeType || 'audio/webm;codecs=opus',
      timestamp: data.timestamp || Date.now(),
      senderId: socket.id
    });
  });
};

// Hàm join phòng bình luận (nếu cần)
const joinCommentaryRoom = (socket, data) => {
  if (!data || !data.accessCode) return;
  
  const roomName = `commentary_${data.accessCode}`;
  socket.join(roomName);
  logger.info(`[Audio] Socket ${socket.id} joined commentary room ${roomName}`);
};

module.exports = {
  handleAudio,
  joinCommentaryRoom
};
