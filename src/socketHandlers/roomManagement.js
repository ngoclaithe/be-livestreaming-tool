const logger = require('../utils/logger');

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
  // TODO: Implement actual validation (e.g., check against database)
  // For now, accept any non-empty string
  return accessCode && typeof accessCode === 'string' && accessCode.trim().length > 0;
}

/**
 * Handles room management events (join, leave, etc.)
 */
function handleRoomManagement(io, socket, rooms, userSessions) {
  // Join room event
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
      
      // Validate access code
      const isValid = await validateAccessCode(accessCode);
      if (!isValid) {
        socket.emit('room_error', {
          error: 'Mã truy cập không hợp lệ',
          accessCode: accessCode
        });
        return;
      }
      
      // Create room if it doesn't exist
      if (!rooms.has(accessCode)) {
        const newRoom = createNewRoom(accessCode);
        rooms.set(accessCode, newRoom);
        logger.info(`Created new room: ${accessCode}`, {
          roomId: accessCode,
          clientType,
          socketId: socket.id
        });
        
        // If this is the first client, make them the admin
        if (clientType === 'admin' || clientType === 'display') {
          newRoom.adminClients.add(socket.id);
        }
      }
      
      const room = rooms.get(accessCode);
      
      // Add client to room
      socket.join(`room_${accessCode}`);
      
      // Update client state
      const userData = userSessions.get(socket.id);
      if (!userData) {
        logger.error('User session not found for socket', { socketId: socket.id });
        throw new Error('Lỗi phiên người dùng');
      }
      
      // If client was in another room, clean up
      if (userData.currentRoom && userData.currentRoom !== accessCode) {
        this.handleLeaveRoom(socket, userData.currentRoom);
      }
      
      // Update user session
      userData.clientType = clientType;
      userData.currentRoom = accessCode;
      userData.lastActive = new Date();
      
      // Add to appropriate client set in room
      if (clientType === 'admin') {
        room.adminClients.add(socket.id);
        logger.info(`Admin client joined room ${accessCode}`, { socketId: socket.id });
      } else if (clientType === 'display') {
        room.displayClients.add(socket.id);
        logger.info(`Display client joined room ${accessCode}`, { socketId: socket.id });
      } else {
        room.clients.add(socket.id);
        logger.info(`Client joined room ${accessCode}`, { socketId: socket.id });
      }
      
      // Send current state to the joining client
      socket.emit('room_joined', {
        accessCode: accessCode,
        roomId: `room_${accessCode}`,
        currentState: room.currentState,
        clientCount: room.clients.size,
        isAdmin: clientType === 'admin'
      });
      
      // Notify other clients about the new join
      if (room.clients.size > 1) { // Only broadcast if there are other clients
        socket.to(`room_${accessCode}`).emit('client_joined', {
          clientId: socket.id,
          clientType: clientType,
          clientCount: room.clients.size
        });
      }
      
      logger.info(`Client ${socket.id} joined room ${accessCode} as ${clientType}. Total clients: ${room.clients.size}`);
      
    } catch (error) {
      logger.error('Error in join_room:', error);
      socket.emit('room_error', {
        error: 'Lỗi khi tham gia phòng',
        details: error.message
      });
    }
  });
  
  /**
   * Handle client disconnection
   */
  socket.on('disconnect', () => {
    const userData = userSessions.get(socket.id);
    if (!userData) {
      logger.warn('Disconnect called for non-existent user session', { socketId: socket.id });
      return;
    }
    
    logger.info(`Client disconnecting: ${socket.id}`, {
      clientType: userData.clientType,
      room: userData.currentRoom
    });
    
    // Remove from any rooms
    if (userData.currentRoom) {
      const room = rooms.get(userData.currentRoom);
      if (room) {
        // Remove from all client sets
        room.clients.delete(socket.id);
        room.adminClients.delete(socket.id);
        room.displayClients.delete(socket.id);
        
        // Log the remaining clients for debugging
        logger.info(`Client left room ${userData.currentRoom}`, {
          socketId: socket.id,
          clientsRemaining: room.clients.size,
          adminsRemaining: room.adminClients.size,
          displaysRemaining: room.displayClients.size
        });
        
        // Clean up empty rooms
        if (room.clients.size === 0 && room.adminClients.size === 0 && room.displayClients.size === 0) {
          rooms.delete(userData.currentRoom);
          logger.info(`Room ${userData.currentRoom} removed (no clients)`);
        } else {
          // Notify remaining clients about the disconnection if needed
          if (userData.clientType === 'admin') {
            socket.to(`room_${userData.currentRoom}`).emit('admin_disconnected', {
              socketId: socket.id,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Remove user session
    userSessions.delete(socket.id);
    logger.info(`User session removed for socket: ${socket.id}`);
  });
  
  // Leave room event
  socket.on('leave_room', (data) => {
    try {
      const { accessCode } = data || {};
      
      if (!accessCode) {
        throw new Error('Access code is required');
      }
      
      const room = rooms.get(accessCode);
      if (!room) {
        throw new Error('Room not found');
      }
      
      // Leave the room
      socket.leave(`room_${accessCode}`);
      
      // Update room data
      room.clients.delete(socket.id);
      room.adminClients.delete(socket.id);
      room.displayClients.delete(socket.id);
      
      // Notify other clients
      socket.to(`room_${accessCode}`).emit('client_left', {
        clientId: socket.id,
        clientCount: room.clients.size
      });
      
      // Clean up empty rooms
      if (room.clients.size === 0) {
        rooms.delete(accessCode);
        logger.info(`Room ${accessCode} cleaned up (no more clients)`);
      }
      
      // Update user session
      const userData = userSessions.get(socket.id);
      if (userData) {
        userData.accessCode = null;
        userData.clientType = null;
      }
      
      socket.emit('room_left', {
        accessCode: accessCode,
        message: 'Đã rời phòng thành công'
      });
      
      logger.info(`Client ${socket.id} left room ${accessCode}. Remaining clients: ${room.clients.size}`);
      
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

// This module handles room management functionality including joining and leaving rooms,
// validating access codes, and maintaining room state. It integrates with the main
// WebSocket server to provide real-time room-based communication.
