const logger = require('../utils/logger');
const { sequelize, RoomSession } = require('../models');
const { Op } = require('sequelize');

/**
 * Creates a new room with default values
 * @param {string} accessCode - The access code for the room
 * @returns {Object} The newly created room object
 */
function createNewRoom(accessCode) {
  return {
    accessCode: accessCode,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    clients: new Set(),
    adminClients: new Set(),
    displayClients: new Set(),
    timer: {
      isRunning: false,
      startTime: 0,
      pausedTime: 0,
      lastUpdate: Date.now(),
      displayTime: '00:00'
    },
    currentState: {
      view: 'poster',
      matchData: {
        homeTeam: { name: "ĐỘI A", score: 0, logo: null },
        awayTeam: { name: "ĐỘI B", score: 0, logo: null },
        matchTime: "00:00",
        period: "Chưa bắt đầu",
        status: "waiting",
        tournament: "",
        stadium: "",
        matchDate: "",
        liveText: ""
      },
      matchStats: {
        possession: { team1: 50, team2: 50 },
        totalShots: { team1: 0, team2: 0 },
        shotsOnTarget: { team1: 0, team2: 0 },
        corners: { team1: 0, team2: 0 },
        yellowCards: { team1: 0, team2: 0 },
        fouls: { team1: 0, team2: 0 }
      },
      displaySettings: {
        selectedSkin: 1,
        selectedPoster: 'tretrung',
        showStats: false,
        showPenalty: false
      },
      penaltyData: {
        homeGoals: 0,
        awayGoals: 0,
        currentTurn: 'home',
        shootHistory: [],
        status: 'ready'
      },
      marqueeData: {
        text: '',
        mode: 'none',
        interval: 0,
        color: '#ffffff',
        fontSize: 16
      }
    }
  };
}

/**
 * Validates an access code (placeholder - implement actual validation)
 * @param {string} accessCode - The access code to validate
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
async function validateAccessCode(accessCode) {
  return accessCode && typeof accessCode === 'string' && accessCode.trim().length > 0;
}

function handleRoomManagement(io, socket, rooms, userSessions) {
  socket.on('join_room', async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      const { accessCode, clientType = 'client' } = data;
      
      if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
        logger.error('Invalid access code format:', { accessCode, socketId: socket.id });
        throw new Error('Mã truy cập không hợp lệ');
      }

      logger.info(`Client ${socket.id} joining room: ${accessCode} as ${clientType}`);
      
      const isValid = await validateAccessCode(accessCode);
      
      if (!isValid) {
        socket.emit('room_error', {
          error: 'Mã truy cập không hợp lệ',
          accessCode: accessCode
        });
        return;
      }
      
      const now = new Date();
      
      let roomSession = await RoomSession.findOne({ where: { accessCode } });
      
      if (!roomSession) {
        const initialClientConnected = (clientType === 'admin' || clientType === 'client') ? [socket.id] : [];
        const initialDisplayConnected = (clientType === 'display') ? [socket.id] : [];
        
        let expiredAt = null;
        if (clientType === 'display') {
          expiredAt = new Date();
          expiredAt.setHours(expiredAt.getHours() + 2);
          logger.info(`First display connected, setting expiredAt to: ${expiredAt}`);
        }
        
        roomSession = await RoomSession.create({
          accessCode,
          status: 'active',
          expiredAt: expiredAt,
          clientConnected: initialClientConnected,
          displayConnected: initialDisplayConnected,
          lastActivityAt: now
        });
      } else {
        const updateData = { lastActivityAt: now };
        
        if (clientType === 'admin' || clientType === 'client') {
          if (!roomSession.clientConnected.includes(socket.id)) {
            updateData.clientConnected = [...roomSession.clientConnected, socket.id];
          }
        } else if (clientType === 'display') {
          if (!roomSession.displayConnected.includes(socket.id)) {
            updateData.displayConnected = [...roomSession.displayConnected, socket.id];
            
            if (roomSession.displayConnected.length === 0) {
              const expiredAt = new Date();
              expiredAt.setHours(expiredAt.getHours() + 2);
              updateData.expiredAt = expiredAt;
              logger.info(`First display connected, setting expiredAt to: ${expiredAt}`);
            }
          }
        }
        
        await roomSession.update(updateData);
      }
      
      if (!rooms.has(accessCode)) {
        rooms.set(accessCode, createNewRoom(accessCode));
      }
      
      const room = rooms.get(accessCode);
      
      socket.join(`room_${accessCode}`);
      
      const userData = userSessions.get(socket.id);
      if (!userData) {
        logger.error('User session not found for socket', { socketId: socket.id });
        throw new Error('Lỗi phiên người dùng');
      }
      
      if (userData.currentRoom && userData.currentRoom !== accessCode) {
        this.handleLeaveRoom(socket, userData.currentRoom);
      }
      
      userData.clientType = clientType;
      userData.currentRoom = accessCode;
      
      if (clientType === 'admin') {
        room.adminClients.add(socket.id);
      } else if (clientType === 'client') {
        room.clients.add(socket.id);
      } else if (clientType === 'display') {
        room.displayClients.add(socket.id);
      }
      
      logger.info(`Client joined room ${accessCode}`, { socketId: socket.id });
      
      socket.emit('room_joined', {
        accessCode: accessCode,
        roomId: `room_${accessCode}`,
        currentState: room.currentState,
        clientCount: room.clients.size + room.adminClients.size,
        isAdmin: clientType === 'admin'
      });
      
      if (room.clients.size + room.adminClients.size > 1) { 
        socket.to(`room_${accessCode}`).emit('client_joined', {
          clientId: socket.id,
          clientType: clientType,
          clientCount: room.clients.size + room.adminClients.size
        });
      }
      
      logger.info(`Client ${socket.id} joined room ${accessCode} as ${clientType}. Total clients: ${room.clients.size + room.adminClients.size}`);
      
    } catch (error) {
      logger.error('Error in join_room:', error);
      socket.emit('room_error', {
        error: 'Lỗi khi tham gia phòng',
        details: error.message
      });
    }
  });
  
  socket.on('disconnect', async () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    for (const [accessCode, room] of rooms.entries()) {
      let shouldUpdateDb = false;
      let updateData = {};
      
      if (room.adminClients.has(socket.id)) {
        room.adminClients.delete(socket.id);
        shouldUpdateDb = true;
        
        try {
          const roomSession = await RoomSession.findOne({ where: { accessCode } });
          if (roomSession) {
            const updatedClientConnected = roomSession.clientConnected.filter(id => id !== socket.id);
            updateData.clientConnected = updatedClientConnected;
          }
        } catch (error) {
          logger.error('Error finding RoomSession on admin disconnect:', error);
        }
      } else if (room.clients.has(socket.id)) {
        room.clients.delete(socket.id);
        shouldUpdateDb = true;
        
        try {
          const roomSession = await RoomSession.findOne({ where: { accessCode } });
          if (roomSession) {
            const updatedClientConnected = roomSession.clientConnected.filter(id => id !== socket.id);
            updateData.clientConnected = updatedClientConnected;
          }
        } catch (error) {
          logger.error('Error finding RoomSession on client disconnect:', error);
        }
      } else if (room.displayClients.has(socket.id)) {
        room.displayClients.delete(socket.id);
        shouldUpdateDb = true;
        
        try {
          const roomSession = await RoomSession.findOne({ where: { accessCode } });
          if (roomSession) {
            const updatedDisplayConnected = roomSession.displayConnected.filter(id => id !== socket.id);
            updateData.displayConnected = updatedDisplayConnected;
          }
        } catch (error) {
          logger.error('Error finding RoomSession on display disconnect:', error);
        }
      }
      
      if (shouldUpdateDb && Object.keys(updateData).length > 0) {
        try {
          await RoomSession.update(updateData, {
            where: { accessCode }
          });
        } catch (error) {
          logger.error('Error updating RoomSession on disconnect:', error);
        }
      }
      
      if (room.clients.size === 0 && room.adminClients.size === 0 && room.displayClients.size === 0) {
        try {
          await RoomSession.destroy({ where: { accessCode } });
          rooms.delete(accessCode);
          logger.info(`Room ${accessCode} removed (no clients)`);
        } catch (error) {
          logger.error('Error removing RoomSession:', error);
        }
      }
    }
    
    userSessions.delete(socket.id);
    logger.info(`User session removed for socket: ${socket.id}`);
  });
  
  socket.on('leave_room', async (data) => {
    try {
      const { accessCode } = data || {};
      
      if (!accessCode) {
        throw new Error('Access code is required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      socket.leave(`room_${accessCode}`);
      
      let shouldUpdateDb = false;
      let updateData = {};
      
      if (room.adminClients.has(socket.id)) {
        room.adminClients.delete(socket.id);
        shouldUpdateDb = true;
        
        const roomSession = await RoomSession.findOne({ where: { accessCode } });
        if (roomSession) {
          const updatedClientConnected = roomSession.clientConnected.filter(id => id !== socket.id);
          updateData.clientConnected = updatedClientConnected;
        }
      } else if (room.clients.has(socket.id)) {
        room.clients.delete(socket.id);
        shouldUpdateDb = true;
        
        const roomSession = await RoomSession.findOne({ where: { accessCode } });
        if (roomSession) {
          const updatedClientConnected = roomSession.clientConnected.filter(id => id !== socket.id);
          updateData.clientConnected = updatedClientConnected;
        }
      } else if (room.displayClients.has(socket.id)) {
        room.displayClients.delete(socket.id);
        shouldUpdateDb = true;
        
        const roomSession = await RoomSession.findOne({ where: { accessCode } });
        if (roomSession) {
          const updatedDisplayConnected = roomSession.displayConnected.filter(id => id !== socket.id);
          updateData.displayConnected = updatedDisplayConnected;
        }
      }
      
      if (shouldUpdateDb && Object.keys(updateData).length > 0) {
        await RoomSession.update(updateData, {
          where: { accessCode }
        });
      }
      
      socket.to(`room_${accessCode}`).emit('client_left', {
        clientId: socket.id,
        clientCount: room.clients.size + room.adminClients.size
      });
      
      if (room.clients.size === 0 && room.adminClients.size === 0 && room.displayClients.size === 0) {
        await RoomSession.destroy({ where: { accessCode } });
        rooms.delete(accessCode);
        logger.info(`Room ${accessCode} cleaned up (no more clients)`);
      }
      
      const userData = userSessions.get(socket.id);
      if (userData) {
        userData.currentRoom = null;
        userData.clientType = null;
      }
      
      socket.emit('room_left', {
        accessCode: accessCode,
        message: 'Đã rời phòng thành công'
      });
      
      logger.info(`Client ${socket.id} left room ${accessCode}. Remaining clients: ${room.clients.size + room.adminClients.size}`);
      
    } catch (error) {
      logger.error('Error in leave_room:', error);
      socket.emit('room_error', {
        error: 'Lỗi khi rời phòng',
        details: error.message
      });
    }
  });
}

module.exports = { handleRoomManagement };