const logger = require('../utils/logger');

function handleViewUpdates(io, socket, rooms, userSessions) {
  socket.on('view_update', (data) => {
    console.log("Giá trị nhận được là:", data);
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      const { accessCode, viewType, timestamp = Date.now() } = data;
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      if (!viewType || typeof viewType !== 'string') {
        throw new Error('Loại giao diện không hợp lệ');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('view_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('view_error', {
          error: 'Bạn không có quyền thực hiện thao tác này',
          code: 'UNAUTHORIZED',
          timestamp: Date.now()
        });
      }
      
      logger.info(`View update request: ${viewType} for room ${accessCode}`, {
        socketId: socket.id,
        timestamp: timestamp
      });
      
      room.currentState.view = viewType;
      room.lastActivity = timestamp;
      
      socket.to(`room_${accessCode}`).emit('view_updated', {
        viewType: viewType,
        timestamp: timestamp,
        accessCode: accessCode
      });
      
      socket.emit('view_updated', {
        viewType: viewType,
        timestamp: timestamp,
        accessCode: accessCode
      });
      
      logger.info(`Broadcasted view_updated: ${viewType} to room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in view_update:', error);
      socket.emit('view_error', {
        error: 'Lỗi khi cập nhật giao diện',
        details: error.message
      });
    }
  });
  
  socket.on('poster_update', (data) => {
    try {
      console.log('📢 Nhận yêu cầu cập nhật poster:', data);
      const { accessCode, posterType, timestamp = Date.now() } = data;
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('poster_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
            
      console.log(`🔄 Đang cập nhật poster từ '${room.currentState.displaySettings.selectedPoster}' sang '${posterType}'`);
      room.currentState.displaySettings.selectedPoster = posterType;
      room.lastActivity = timestamp;
      
      const updateData = {
        posterType: posterType,
        timestamp: timestamp,
        accessCode: accessCode
      };
      console.log('📤 Gửi thông báo cập nhật poster đến tất cả client:', updateData);
      io.to(`room_${accessCode}`).emit('poster_updated', updateData);
      
      logger.info(`Poster updated: ${posterType} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in poster_update:', error);
      socket.emit('poster_error', {
        error: 'Lỗi khi cập nhật poster',
        details: error.message
      });
    }
  });
  
  // Template update
  socket.on('template_update', (data) => {
    try {
      const { accessCode, templateId, timestamp = Date.now() } = data;
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        throw new Error('Mã truy cập không hợp lệ');
      }
      
      const templateIdNum = parseInt(templateId);
      if (isNaN(templateIdNum) || templateIdNum < 1 || templateIdNum > 5) {
        throw new Error('ID template phải là số từ 1 đến 5');
      }
      
      // Get room and validate
      const room = rooms.get(accessCode);
      if (!room) {
        logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
        return socket.emit('template_error', {
          error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
          code: 'ROOM_NOT_FOUND',
          timestamp: Date.now()
        });
      }
      
      // Verify admin permission
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('template_error', {
          error: 'Bạn không có quyền thay đổi template',
          code: 'UNAUTHORIZED',
          timestamp: Date.now()
        });
      }
      
      // Update room state with the new template
      room.currentState.displaySettings.selectedSkin = templateIdNum;
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('template_updated', {
        templateId: templateId,
        timestamp: timestamp,
        accessCode: accessCode
      });
      
      logger.info(`Template updated: ${templateId} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in template_update:', error);
      socket.emit('template_error', {
        error: 'Lỗi khi cập nhật giao diện',
        details: error.message
      });
    }
  });
}

module.exports = { handleViewUpdates };
