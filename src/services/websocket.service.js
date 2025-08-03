const logger = require('../utils/logger');

const { handleConnection } = require('../socketHandlers/connection');
const { handleRoomManagement } = require('../socketHandlers/roomManagement');
const { handleViewUpdates } = require('../socketHandlers/viewUpdates');
const { handleMatchData } = require('../socketHandlers/matchData');
const { handleDisplaySettings } = require('../socketHandlers/displaySettings');
const { handleTimer, processTimerTick } = require('../socketHandlers/timerHandler');
const { handleAudioUpdates, joinCommentaryRoom } = require('../socketHandlers/audioHandler');

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.connections = new Map();
    this.rooms = new Map(); // accessCode -> roomData
    this.userSessions = new Map(); // socketId -> userData
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

    this.setupCleanupInterval();

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

  setupCleanupInterval() {
    const CLEANUP_INTERVAL = 60 * 60 * 1000; 
    const MAX_INACTIVE_TIME = 24 * 60 * 60 * 1000; 
    
    setInterval(() => {
      const now = Date.now();
      let roomsCleaned = 0;
      
      for (const [accessCode, room] of this.rooms.entries()) {
        if (now - room.lastActivity > MAX_INACTIVE_TIME && room.clients.size === 0) {
          this.rooms.delete(accessCode);
          roomsCleaned++;
        }
      }
      
      if (roomsCleaned > 0) {
        logger.info(`Cleaned up ${roomsCleaned} inactive rooms`);
      }
    }, CLEANUP_INTERVAL);
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
    if (!this.timerIntervals) {
      this.timerIntervals = new Map();
    }
    
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
    if (this.timerIntervals?.has(accessCode)) {
      clearInterval(this.timerIntervals.get(accessCode));
      this.timerIntervals.delete(accessCode);
      logger.info(`Timer interval cleaned up for room ${accessCode}`);
    }
  }
  
  /**
   * Clean up all resources
   */
  cleanup() {
    // Clear all timer intervals
    if (this.timerIntervals) {
      this.timerIntervals.forEach((interval) => clearInterval(interval));
      this.timerIntervals.clear();
    }
    
    // Clear all connections
    this.connections.clear();
    this.userSessions.clear();
    this.rooms.clear();
  }
}

module.exports = WebSocketService;