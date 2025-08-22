const logger = require('../utils/logger');
const { View, AccessCode } = require('../models');

function handleViewUpdates(io, socket, rooms, userSessions) {
  // ===== View update =====
  socket.on('view_update', async (data) => {
    console.log("Giá trị nhận được là:", data);
    try {
      if (!data || typeof data !== 'object') throw new Error('Invalid data format');

      const { accessCode, viewType, timestamp = Date.now() } = data;

      if (!accessCode || !viewType) throw new Error('Thiếu dữ liệu cần thiết');

      const room = rooms.get(accessCode);
      if (!room) {
        return socket.emit('view_error', { error: 'ROOM_NOT_FOUND' });
      }

      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('view_error', { error: 'UNAUTHORIZED' });
      }

      // ===== Update DB =====
      const ac = await AccessCode.findOne({ where: { code: accessCode } });
      if (ac) {
        await View.upsert({
          accessCodeId: ac.id,
          currentView: viewType,
        });
      }

      // Update memory state + broadcast
      room.currentState.view = viewType;
      room.lastActivity = timestamp;

      io.to(`room_${accessCode}`).emit('view_updated', {
        viewType, timestamp, accessCode
      });

    } catch (error) {
      logger.error('Error in view_update:', error);
      socket.emit('view_error', { error: error.message });
    }
  });

  // ===== Poster update =====
  socket.on('poster_update', async (data) => {
    try {
      console.log("Giá trị nhận được khi poster update là", data);
      const { accessCode, posterType, posterData, customPosterUrl, timestamp = Date.now() } = data;
      if (!accessCode || !posterType) throw new Error('Thiếu dữ liệu');

      const room = rooms.get(accessCode);
      if (!room) return socket.emit('poster_error', { error: 'ROOM_NOT_FOUND' });

      // Update current state
      room.currentState.displaySettings.selectedPoster = posterType;
      room.lastActivity = timestamp;

      // Nếu là custom poster, cập nhật URL
      if (posterType === 'custom' && customPosterUrl) {
        room.currentState.displaySettings.url_custom_poster = customPosterUrl;
      }

      // ===== Update DB =====
      const ac = await AccessCode.findOne({ where: { code: accessCode } });
      if (ac) {
        const updateData = {
          accessCodeId: ac.id,
          poster_type: posterType,
        };
        if (posterType === 'custom' && customPosterUrl) {
          updateData.url_custom_poster = customPosterUrl;
        }

        await View.upsert(updateData);
      }

      io.to(`room_${accessCode}`).emit('poster_updated', {
        posterType, 
        customPosterUrl: posterType === 'custom' ? customPosterUrl : null,
        timestamp, 
        accessCode
      });

    } catch (error) {
      logger.error('Error in poster_update:', error);
      socket.emit('poster_error', { error: error.message });
    }
  });

  // ===== Template update =====
  socket.on('template_update', async (data) => {
    try {
      const { accessCode, templateId, timestamp = Date.now() } = data;
      if (!accessCode || !templateId) throw new Error('Thiếu dữ liệu');

      const templateIdNum = parseInt(templateId);
      if (isNaN(templateIdNum) || templateIdNum < 1 || templateIdNum > 5) {
        throw new Error('ID template phải là số từ 1 đến 5');
      }

      const room = rooms.get(accessCode);
      if (!room) return socket.emit('template_error', { error: 'ROOM_NOT_FOUND' });

      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        return socket.emit('template_error', { error: 'UNAUTHORIZED' });
      }

      room.currentState.displaySettings.selectedSkin = templateIdNum;
      room.lastActivity = timestamp;

      // ===== Update DB =====
      const ac = await AccessCode.findOne({ where: { code: accessCode } });
      if (ac) {
        await View.upsert({
          accessCodeId: ac.id,
          templateId: templateIdNum,
        });
      }

      io.to(`room_${accessCode}`).emit('template_updated', {
        templateId: templateIdNum, timestamp, accessCode
      });

    } catch (error) {
      logger.error('Error in template_update:', error);
      socket.emit('template_error', { error: error.message });
    }
  });
}

module.exports = { handleViewUpdates };