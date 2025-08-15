const logger = require('../utils/logger');


function handleAudioUpdates(io, socket, rooms, userSessions) {
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
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      if (!command || typeof command !== 'string') {
        throw new Error('Lệnh điều khiển âm thanh không hợp lệ');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('audio_control_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
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
      
      const validCommands = ['PLAY_REFEREE_VOICE', 'PLAY_REFEREE_VOICE_REALTIME', 'STOP_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO'];
      if (!validCommands.includes(command)) {
        throw new Error(`Lệnh không được hỗ trợ: ${command}`);
      }
      
      if (command === 'PLAY_REFEREE_VOICE') {
        if (!payload.audioData || !payload.mimeType) {
          throw new Error('Thiếu dữ liệu âm thanh hoặc mimeType');
        }
      }
      
      room.lastActivity = timestamp;
      
      const controlMessage = {
        command,
        payload,
        senderType,
        timestamp,
        accessCode,
        from: socket.id
      };
      
      if (target === 'all') {
        io.to(`room_${accessCode}`).emit('audio_control', controlMessage);
      } else if (['client', 'admin', 'display'].includes(target)) {
        // console.log('Vừa gửi xong nèeee');
        io.to(`room_${accessCode}`).emit('audio_control', {
          ...controlMessage,
          target: target
        });
      } else {
        io.to(target).emit('audio_control', controlMessage);
      }
      
      // logger.info(`Audio control broadcasted: ${command} to ${target} in room ${accessCode}`);
      
    } catch (error) {
      // logger.error('Error in audio_control_broadcast:', error);
      socket.emit('audio_control_error', {
        error: 'Lỗi khi xử lý điều khiển âm thanh',
        details: error.message,
        timestamp: Date.now()
      });
    }
  });
  
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
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      if (!command || typeof command !== 'string') {
        throw new Error('Lệnh điều khiển âm thanh không hợp lệ');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('audio_control_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
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
      
      const validCommands = ['PLAY_REFEREE_VOICE', 'PLAY_REFEREE_VOICE_REALTIME', 'STOP_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO'];
      if (!validCommands.includes(command)) {
        throw new Error(`Lệnh không được hỗ trợ: ${command}`);
      }
      
      if (command === 'PLAY_REFEREE_VOICE' || command === 'PLAY_REFEREE_VOICE_REALTIME') {
        if (!payload.audioData || !payload.mimeType) {
          throw new Error('Thiếu dữ liệu âm thanh hoặc mimeType');
        }
      }
      
      room.lastActivity = timestamp;
      
      const controlMessage = {
        command,
        payload,
        senderType,
        timestamp,
        accessCode,
        from: socket.id
      };
      
      socket.to(`room_${accessCode}`).emit('audio_control_received', controlMessage);
      
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