const logger = require('../utils/logger');

/**
 * Handles all audio-related socket events
 */
function handleAudioUpdates(io, socket, rooms, userSessions) {
  // Audio control broadcast event
  socket.on('audio_control_broadcast', (data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      const { 
        accessCode, 
        command, 
        target = 'all', 
        payload = {}, 
        senderType, 
        timestamp = Date.now() 
      } = data;
      
      // Validate input
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      if (!command || typeof command !== 'string') {
        throw new Error('Lệnh điều khiển âm thanh không hợp lệ');
      }
      
      // Get room and validate
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('audio_control_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
      // Verify admin permission
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('audio_control_error', {
          error: 'Bạn không có quyền thực hiện thao tác này',
          code: 'UNAUTHORIZED',
          timestamp: Date.now()
        });
      }
      
      logger.info(`Audio control request: ${command} for room ${accessCode}`, {
        socketId: socket.id,
        target: target,
        timestamp: timestamp
      });
      
      // Validate command types
      const validCommands = ['PLAY_REFEREE_VOICE', 'STOP_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO'];
      if (!validCommands.includes(command)) {
        throw new Error(`Lệnh không được hỗ trợ: ${command}`);
      }
      
      // Additional validation for PLAY_REFEREE_VOICE
      if (command === 'PLAY_REFEREE_VOICE') {
        if (!payload.audioData || !payload.mimeType) {
          throw new Error('Thiếu dữ liệu âm thanh hoặc mimeType');
        }
      }
      
      // Update room activity
      room.lastActivity = timestamp;
      
      // Build control message
      const controlMessage = {
        command,
        payload,
        senderType,
        timestamp,
        accessCode,
        from: socket.id
      };
      
      // Send to specific target based on target parameter
      if (target === 'all') {
        // Send to all clients in the room
        io.to(`room_${accessCode}`).emit('audio_control', controlMessage);
      } else if (['client', 'admin', 'display'].includes(target)) {
        // Send to specific client type in the room
        console.log('Vừa gửi xong nèeee');
        io.to(`room_${accessCode}`).emit('audio_control', {
          ...controlMessage,
          target: target
        });
      } else {
        // Send to specific client by ID
        io.to(target).emit('audio_control', controlMessage);
      }
      
      logger.info(`Audio control broadcasted: ${command} to ${target} in room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in audio_control_broadcast:', error);
      socket.emit('audio_control_error', {
        error: 'Lỗi khi xử lý điều khiển âm thanh',
        details: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Audio control event (for direct control)
  socket.on('audio_control', (data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      const { 
        accessCode, 
        command, 
        payload = {}, 
        senderType, 
        timestamp = Date.now() 
      } = data;
      
      // Validate input
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      if (!command || typeof command !== 'string') {
        throw new Error('Lệnh điều khiển âm thanh không hợp lệ');
      }
      
      // Get room and validate
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('audio_control_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
      // Verify admin permission
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('audio_control_error', {
          error: 'Bạn không có quyền thực hiện thao tác này',
          code: 'UNAUTHORIZED',
          timestamp: Date.now()
        });
      }
      
      logger.info(`Direct audio control: ${command} for room ${accessCode}`, {
        socketId: socket.id,
        timestamp: timestamp
      });
      
      // Validate command types
      const validCommands = ['PLAY_REFEREE_VOICE', 'STOP_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO'];
      if (!validCommands.includes(command)) {
        throw new Error(`Lệnh không được hỗ trợ: ${command}`);
      }
      
      // Additional validation for PLAY_REFEREE_VOICE
      if (command === 'PLAY_REFEREE_VOICE') {
        if (!payload.audioData || !payload.mimeType) {
          throw new Error('Thiếu dữ liệu âm thanh hoặc mimeType');
        }
      }
      
      // Update room activity
      room.lastActivity = timestamp;
      
      // Build control message
      const controlMessage = {
        command,
        payload,
        senderType,
        timestamp,
        accessCode,
        from: socket.id
      };
      
      // Broadcast to all clients in the room EXCEPT the sender
      socket.to(`room_${accessCode}`).emit('audio_control_received', controlMessage);
      
      // Also send confirmation to the sender
      socket.emit('audio_control_received', controlMessage);
      
      logger.info(`Audio control executed: ${command} in room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in audio_control:', error);
      socket.emit('audio_control_error', {
        error: 'Lỗi khi xử lý điều khiển âm thanh',
        details: error.message,
        timestamp: Date.now()
      });
    }
  });
}

module.exports = { handleAudioUpdates };