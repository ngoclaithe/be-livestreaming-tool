const logger = require('../utils/logger');

/**
 * Handles all display settings related socket events
 */
function handleDisplaySettings(io, socket, rooms, userSessions) {
  
  // Sponsors update
  socket.on('sponsors_update', (data) => {
    try {
      const { accessCode, sponsors, timestamp = Date.now() } = data;
      
      if (!accessCode || !sponsors) {
        throw new Error('Access code and sponsors data are required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      // Verify user has permission (only admin can update sponsors)
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update sponsors');
      }
      
      // Initialize sponsors in room state if not exists
      if (!room.currentState.sponsors) {
        room.currentState.sponsors = {
          main: [],
          secondary: [],
          media: []
        };
      }
      
      // Update sponsors data
      if (sponsors.main !== undefined) {
        room.currentState.sponsors.main = sponsors.main || [];
      }
      if (sponsors.secondary !== undefined) {
        room.currentState.sponsors.secondary = sponsors.secondary || [];
      }
      if (sponsors.media !== undefined) {
        room.currentState.sponsors.media = sponsors.media || [];
      }
      
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('sponsors_updated', {
        sponsors: room.currentState.sponsors,
        timestamp: timestamp
      });
      
      logger.info(`Sponsors updated for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in sponsors_update:', error);
      socket.emit('sponsors_error', {
        error: 'Lỗi khi cập nhật nhà tài trợ',
        details: error.message
      });
    }
  });
  
  // General match info update (tournament, stadium, etc.)
  socket.on('match_info_update', (data) => {
    try {
      const { accessCode, matchInfo, timestamp = Date.now() } = data;
      
      if (!accessCode || !matchInfo) {
        throw new Error('Access code and match info are required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      // Verify user has permission (only admin can update match info)
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update match info');
      }
      
      // Update match info
      // Cập nhật các trường thông tin trận đấu
      const fieldsToUpdate = [
        'tournament', 'stadium', 'matchDate', 'liveText', 'startTime'
      ];
      
      fieldsToUpdate.forEach(field => {
        if (matchInfo[field] !== undefined) {
          room.currentState.matchData[field] = matchInfo[field];
        }
      });
      
      // Xử lý trường time (đồng bộ với startTime nếu cần)
      if (matchInfo.time !== undefined) {
        room.currentState.matchData.startTime = matchInfo.time;
      }
      
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      const responseMatchInfo = {};
      const possibleFields = ['tournament', 'stadium', 'matchDate', 'liveText', 'startTime'];
      
      possibleFields.forEach(field => {
        if (room.currentState.matchData[field] !== undefined) {
          responseMatchInfo[field] = room.currentState.matchData[field];
        }
      });
      
      io.to(`room_${accessCode}`).emit('match_info_updated', {
        matchInfo: responseMatchInfo,
        timestamp: timestamp
      });
      
      logger.info(`Match info updated for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in match_info_update:', error);
      socket.emit('match_info_error', {
        error: 'Lỗi khi cập nhật thông tin trận đấu',
        details: error.message
      });
    }
  });
  
  // Toggle stats display
  socket.on('toggle_stats', (data) => {
    try {
      const { accessCode, show, timestamp = Date.now() } = data;
      
      if (!accessCode || show === undefined) {
        throw new Error('Access code and show flag are required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      // Verify user has permission (only admin can toggle stats)
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can toggle stats');
      }
      
      // Update display settings
      room.currentState.displaySettings.showStats = Boolean(show);
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('stats_toggled', {
        show: room.currentState.displaySettings.showStats,
        timestamp: timestamp
      });
      
      logger.info(`Stats display toggled to ${show} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in toggle_stats:', error);
      socket.emit('toggle_stats_error', {
        error: 'Lỗi khi bật/tắt thống kê',
        details: error.message
      });
    }
  });
  
  // Toggle penalty display
  socket.on('toggle_penalty', (data) => {
    try {
      const { accessCode, show, timestamp = Date.now() } = data;
      
      if (!accessCode || show === undefined) {
        throw new Error('Access code and show flag are required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      // Verify user has permission (only admin can toggle penalty)
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can toggle penalty');
      }
      
      // Update display settings
      room.currentState.displaySettings.showPenalty = Boolean(show);
      room.lastActivity = timestamp;
      
      // If showing penalty, ensure we have a valid state
      if (show && !room.currentState.penaltyData) {
        room.currentState.penaltyData = {
          homeGoals: 0,
          awayGoals: 0,
          currentTurn: 'home',
          shootHistory: [],
          status: 'ready'
        };
      }
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('penalty_toggled', {
        show: room.currentState.displaySettings.showPenalty,
        penaltyData: room.currentState.penaltyData,
        timestamp: timestamp
      });
      
      logger.info(`Penalty display toggled to ${show} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in toggle_penalty:', error);
      socket.emit('toggle_penalty_error', {
        error: 'Lỗi khi bật/tắt đá luân lưu',
        details: error.message
      });
    }
  });
}

module.exports = { handleDisplaySettings };
