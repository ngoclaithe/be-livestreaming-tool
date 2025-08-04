const logger = require('../utils/logger');

const { handleConnection } = require('../socketHandlers/connection');
const { handleRoomManagement, cleanupRoomTimeouts, handleRoomExpiration } = require('../socketHandlers/roomManagement');
const { handleViewUpdates } = require('../socketHandlers/viewUpdates');
const { handleMatchData } = require('../socketHandlers/matchData');
const { handleDisplaySettings } = require('../socketHandlers/displaySettings');
const { handleTimer, processTimerTick } = require('../socketHandlers/timerHandler');
const { handleAudioUpdates, joinCommentaryRoom } = require('../socketHandlers/audioHandler');

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.connections = new Map();
    this.rooms = new Map(); 
    this.userSessions = new Map(); 
    this.timerIntervals = new Map(); 
    this.cleanupInterval = null; // Interval cho cleanup tổng quát
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`New WebSocket connection: ${socket.id}`);
      
      this.connections.set(socket.id, socket);
      
      this.initializeSocketHandlers(socket);
            
      socket.on('join_commentary_room', (data) => {
        joinCommentaryRoom(socket, data);
      });
      
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.connections.delete(socket.id);
        this.userSessions.delete(socket.id);
      });
      
      socket.on('join_room', (data) => {
        if (data.clientType === 'admin' && data.accessCode) {
          this.setupTimerForRoom(data.accessCode);
        }
      });
    });

    // Khởi tạo cleanup interval cho các task tổng quát
    this.setupGeneralCleanupInterval();

    return this.io;
  }

  initializeSocketHandlers(socket) {
    this.userSessions.set(socket.id, {
      socketId: socket.id,
      joinedAt: new Date(),
      lastActive: new Date(),
      clientType: 'unknown',
      currentRoom: null
    });

    handleConnection(this.io, socket, this.rooms, this.userSessions);
    handleRoomManagement(this.io, socket, this.rooms, this.userSessions);
    handleViewUpdates(this.io, socket, this.rooms, this.userSessions);
    handleMatchData(this.io, socket, this.rooms, this.userSessions);
    handleDisplaySettings(this.io, socket, this.rooms, this.userSessions);
    handleTimer(this.io, socket, this.rooms, this.userSessions);
    handleAudioUpdates(this.io, socket, this.rooms, this.userSessions);
    
    this.setupGlobalHandlers(socket);
  }

  setupGlobalHandlers(socket) {
    socket.on('error', (error) => {
      logger.error(`Socket error (${socket.id}):`, error);
    });
    
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') {
        cb('pong');
      }
    });
  }
  setupGeneralCleanupInterval() {
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 giờ
    const MAX_INACTIVE_TIME = 2 * 60 * 60 * 1000; // 2 giờ
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let roomsCleaned = 0;
      let staleConnectionsCleaned = 0;
      
      for (const [accessCode, room] of this.rooms.entries()) {
        if (now - room.lastActivity > MAX_INACTIVE_TIME && 
            room.clients.size === 0 && 
            room.adminClients.size === 0 && 
            room.displayClients.size === 0) {
          this.rooms.delete(accessCode);
          this.cleanupTimerForRoom(accessCode);
          roomsCleaned++;
        }
      }
      
      // Cleanup stale user sessions
      for (const [socketId, session] of this.userSessions.entries()) {
        if (now - session.lastActive.getTime() > MAX_INACTIVE_TIME) {
          if (!this.connections.has(socketId)) {
            this.userSessions.delete(socketId);
            staleConnectionsCleaned++;
          }
        }
      }
      
      if (roomsCleaned > 0 || staleConnectionsCleaned > 0) {
        logger.info(`General cleanup completed: ${roomsCleaned} inactive rooms, ${staleConnectionsCleaned} stale sessions`);
      }
    }, CLEANUP_INTERVAL);

    logger.info('General cleanup interval initialized (1 hour interval)');
  }
  
  broadcastRoomState(roomId, event, data) {
    const room = this.rooms.get(roomId);
    if (room) {
      this.io.to(`room_${roomId}`).emit(event, {
        ...data,
        timestamp: Date.now()
      });
    }
  }
  
  getRoomState(accessCode) {
    const room = this.rooms.get(accessCode);
    return room ? room.currentState : null;
  }
  
  updateRoomState(accessCode, updates) {
    const room = this.rooms.get(accessCode);
    if (room) {
      Object.assign(room.currentState, updates);
      room.lastActivity = Date.now();
      return true;
    }
    return false;
  }
  
  /**
   * Get room by access code
   */
  getRoom(accessCode) {
    return this.rooms.get(accessCode);
  }
  
  /**
   * Get all rooms (for admin purposes)
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }
  
  /**
   * Get active connections count
   */
  getConnectionCount() {
    return this.connections.size;
  }
  
  /**
   * Get active rooms count
   */
  getRoomCount() {
    return this.rooms.size;
  }

  /**
   * Send current room state to a socket
   */
  sendRoomStateToSocket(socket, room) {
    // Define all possible state events
    const stateEvents = [
      { event: 'score_updated', data: { scores: room.scores } },
      { event: 'match_stats_updated', data: { stats: room.stats } },
      { event: 'match_time_updated', data: { time: room.time } },
      { event: 'penalty_updated', data: { penaltyData: room.penaltyData } },
      { event: 'lineup_updated', data: { lineup: room.lineup } },
      { event: 'team_logos_updated', data: { logos: room.teamLogos } },
      { event: 'team_names_updated', data: { names: room.teamNames } },
      { event: 'marquee_updated', data: { marqueeData: room.marqueeData } },
      { event: 'template_updated', data: { templateId: room.templateId } },
      { event: 'poster_updated', data: { posterType: room.posterType } },
      { event: 'sponsors_updated', data: { sponsors: room.sponsors } },
      { event: 'match_title_updated', data: { matchTitle: room.matchTitle } },
      { event: 'match_info_updated', data: { matchInfo: room.matchInfo } },
      { event: 'live_unit_updated', data: { liveUnit: room.liveUnit}},
      // Timer events
      { event: 'timer_started', data: { initialTime: room.timer?.displayTime || '00:00' } },
      { event: 'timer_paused', data: { 
        elapsedTime: room.timer?.pausedTime || 0,
        displayTime: room.timer?.displayTime || '00:00' 
      }},
      { event: 'timer_resumed', data: { 
        displayTime: room.timer?.displayTime || '00:00' 
      }},
      { event: 'timer_reset', data: { 
        initialTime: room.timer?.displayTime || '00:00' 
      }},
      { event: 'timer_tick', data: { 
        displayTime: room.timer?.displayTime || '00:00' 
      }}
    ];

    // Only send events where we have data
    stateEvents.forEach(({ event, data }) => {
      if (data && Object.values(data)[0] !== null && Object.values(data)[0] !== undefined) {
        socket.emit(event, data);
      }
    });
  }

  /**
   * Broadcast to all connected clients in a room
   */
  broadcastToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Send to a specific client
   */
  sendToClient(socketId, event, data) {
    const socket = this.connections.get(socketId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
  
  /**
   * Set up timer for a room if it doesn't exist
   */
  setupTimerForRoom(accessCode) {
    // Only set up timer if not already set up for this room
    if (!this.timerIntervals.has(accessCode)) {
      const interval = setInterval(() => {
        processTimerTick(this.io, this.rooms);
      }, 1000); // Update every second
      
      this.timerIntervals.set(accessCode, interval);
      logger.info(`Timer interval set up for room ${accessCode}`);
    }
  }
  
  /**
   * Clean up timer for a room
   */
  cleanupTimerForRoom(accessCode) {
    if (this.timerIntervals.has(accessCode)) {
      clearInterval(this.timerIntervals.get(accessCode));
      this.timerIntervals.delete(accessCode);
      logger.info(`Timer interval cleaned up for room ${accessCode}`);
    }
  }

  /**
   * Force expire a room manually (for admin purposes)
   */
  async forceExpireRoom(accessCode) {
    try {
      await handleRoomExpiration(this.io, accessCode, this.rooms);
      this.cleanupTimerForRoom(accessCode);
      logger.info(`Room ${accessCode} force expired`);
      return true;
    } catch (error) {
      logger.error(`Error force expiring room ${accessCode}:`, error);
      return false;
    }
  }

  /**
   * Get room expiration info
   */
  async getRoomExpirationInfo(accessCode) {
    try {
      const { RoomSession } = require('../models');
      const roomSession = await RoomSession.findOne({
        where: { accessCode }
      });

      if (!roomSession) {
        return { exists: false };
      }

      const now = new Date();
      const isExpired = roomSession.expiredAt && now > roomSession.expiredAt;

      return {
        exists: true,
        expiredAt: roomSession.expiredAt,
        isExpired,
        status: roomSession.status,
        timeUntilExpired: roomSession.expiredAt ? roomSession.expiredAt.getTime() - now.getTime() : null
      };
    } catch (error) {
      logger.error(`Error getting room expiration info for ${accessCode}:`, error);
      return { exists: false, error: error.message };
    }
  }
  
  /**
   * Clean up all resources
   */
  cleanup() {
    logger.info('Starting WebSocket service cleanup...');
    
    // Clear general cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('General cleanup interval cleared');
    }
    
    // Clear all timer intervals
    if (this.timerIntervals && this.timerIntervals.size > 0) {
      this.timerIntervals.forEach((interval, accessCode) => {
        clearInterval(interval);
        logger.info(`Timer interval cleared for room: ${accessCode}`);
      });
      this.timerIntervals.clear();
    }
    
    // Clean up room timeouts (from optimized room management)
    cleanupRoomTimeouts();
    
    // Disconnect all sockets gracefully
    this.connections.forEach((socket, socketId) => {
      try {
        socket.disconnect(true);
        logger.info(`Socket ${socketId} disconnected during cleanup`);
      } catch (error) {
        logger.error(`Error disconnecting socket ${socketId}:`, error);
      }
    });
    
    // Clear all data structures
    this.connections.clear();
    this.userSessions.clear();
    this.rooms.clear();
    
    logger.info('WebSocket service cleanup completed');
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      connections: this.connections.size,
      rooms: this.rooms.size,
      userSessions: this.userSessions.size,
      timerIntervals: this.timerIntervals.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = WebSocketService;