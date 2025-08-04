const logger = require('../utils/logger');
const { sequelize, RoomSession, Match, AccessCode, DisplaySetting } = require('../models');
const { Op } = require('sequelize');

let globalExpirationChecker = null;

const roomTimeouts = new Map();

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
        teamA: { name: "ĐỘI A", score: 0, logo: null },
        teamB: { name: "ĐỘI B", score: 0, logo: null },
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

async function validateAccessCode(accessCode) {
  return accessCode && typeof accessCode === 'string' && accessCode.trim().length > 0;
}

async function loadRoomData(accessCode) {
  try {
    const accessCodeData = await AccessCode.findOne({
      where: { code: accessCode },
      include: [
        {
          model: Match,
          as: 'match',
          required: false
        }
      ]
    });

    const displaySettings = await DisplaySetting.findAll({
      where: { accessCode: accessCode }
    });

    const roomData = {
      match: null,
      displaySettings: displaySettings || []
    };

    if (accessCodeData && accessCodeData.match) {
      const match = accessCodeData.match;
      roomData.match = {
        id: match.id,
        teamA: {
          name: match.teamAName,
          score: match.homeScore,
          logo: match.teamALogo,
          kitColor: match.teamAkitcolor,
          kit2Color: match.teamA2kitcolor
        },
        teamB: {
          name: match.teamBName,
          score: match.awayScore,
          logo: match.teamBLogo,
          kitColor: match.teamBkitcolor,
          kit2Color: match.teamB2kitcolor
        },
        tournament: match.tournamentName || "",
        tournamentLogo: match.tournamentLogo,
        stadium: match.venue || match.location || "",
        matchDate: match.matchDate,
        status: match.status,
        typeMatch: match.typeMatch,
        matchTitle: match.match_title,
        referee: match.referee,
        attendance: match.attendance,
        liveUnit: match.live_unit,
        stats: {
          possession: match.possession || { home: 50, away: 50 },
          shots: match.shots || { home: 0, away: 0 },
          shotsOnTarget: match.shotsOnTarget || { home: 0, away: 0 },
          corners: match.corners || { home: 0, away: 0 },
          fouls: match.fouls || { home: 0, away: 0 },
          offsides: match.offsides || { home: 0, away: 0 },
          yellowCards: match.yellowCards || { home: 0, away: 0 },
          redCards: match.redCards || { home: 0, away: 0 }
        },
        metadata: match.metadata
      };
    }

    return roomData;
  } catch (error) {
    logger.error('Error loading room data:', error);
    return { match: null, displaySettings: [] };
  }
}

function mergeRoomDataWithState(roomState, loadedData) {
  if (loadedData.match) {
    const match = loadedData.match;
    
    roomState.currentState.matchData = {
      teamA: {
        name: match.teamA.name,
        score: match.teamA.score,
        logo: match.teamA.logo
      },
      teamB: {
        name: match.teamB.name,
        score: match.teamB.score,
        logo: match.teamB.logo
      },
      matchTime: roomState.currentState.matchData.matchTime,
      period: roomState.currentState.matchData.period,
      status: match.status === 'live' ? 'live' : roomState.currentState.matchData.status,
      tournament: match.tournament,
      stadium: match.stadium,
      matchDate: match.matchDate ? new Date(match.matchDate).toLocaleDateString() : "",
      liveText: roomState.currentState.matchData.liveText
    };

    if (match.stats) {
      roomState.currentState.matchStats = {
        possession: {
          team1: match.stats.possession.home || 50,
          team2: match.stats.possession.away || 50
        },
        totalShots: {
          team1: match.stats.shots.home || 0,
          team2: match.stats.shots.away || 0
        },
        shotsOnTarget: {
          team1: match.stats.shotsOnTarget.home || 0,
          team2: match.stats.shotsOnTarget.away || 0
        },
        corners: {
          team1: match.stats.corners.home || 0,
          team2: match.stats.corners.away || 0
        },
        yellowCards: {
          team1: match.stats.yellowCards.home || 0,
          team2: match.stats.yellowCards.away || 0
        },
        fouls: {
          team1: match.stats.fouls.home || 0,
          team2: match.stats.fouls.away || 0
        }
      };
    }
  }

  if (loadedData.displaySettings && loadedData.displaySettings.length > 0) {
    roomState.currentState.displaySettings.logos = loadedData.displaySettings.map(setting => ({
      id: setting.id,
      type: setting.type,
      codelogo: setting.code_logo,
      typeDisplay: setting.type_display,
      position: setting.position,
      urlLogo: setting.url_logo,
      metadata: setting.metadata
    }));
  }

  return roomState;
}

// Hàm tạo timeout riêng cho từng room
function scheduleRoomExpiration(io, accessCode, expiredAt, rooms) {
  // Clear timeout cũ nếu có
  if (roomTimeouts.has(accessCode)) {
    clearTimeout(roomTimeouts.get(accessCode));
  }

  const now = new Date();
  const timeUntilExpired = expiredAt.getTime() - now.getTime();

  if (timeUntilExpired <= 0) {
    // Đã hết hạn rồi, xử lý ngay
    handleRoomExpiration(io, accessCode, rooms);
    return;
  }

  // Tạo timeout mới
  const timeoutId = setTimeout(() => {
    handleRoomExpiration(io, accessCode, rooms);
    roomTimeouts.delete(accessCode);
  }, timeUntilExpired);

  roomTimeouts.set(accessCode, timeoutId);
  logger.info(`Scheduled room expiration for ${accessCode} in ${Math.round(timeUntilExpired / 1000)} seconds`);
}

// Hàm xử lý khi room hết hạn
async function handleRoomExpiration(io, accessCode, rooms) {
  try {
    logger.info(`Processing room expiration for: ${accessCode}`);
    
    // Cập nhật database
    await Promise.all([
      RoomSession.update(
        { status: 'expired' },
        { where: { accessCode } }
      ),
      AccessCode.update(
        { status: 'expired' },
        { where: { code: accessCode } }
      )
    ]);

    // Thông báo tới tất cả clients trong room
    io.to(`room_${accessCode}`).emit('room_expired', {
      message: 'Phòng đã hết hạn sử dụng',
      accessCode: accessCode
    });

    // Đóng tất cả socket connections trong room
    const sockets = await io.in(`room_${accessCode}`).fetchSockets();
    for (const socket of sockets) {
      socket.leave(`room_${accessCode}`);
      socket.disconnect(true);
    }

    // Xóa room khỏi memory
    if (rooms.has(accessCode)) {
      rooms.delete(accessCode);
    }

    // Xóa timeout
    if (roomTimeouts.has(accessCode)) {
      clearTimeout(roomTimeouts.get(accessCode));
      roomTimeouts.delete(accessCode);
    }

    logger.info(`Room ${accessCode} expired and cleaned up successfully`);
  } catch (error) {
    logger.error(`Error handling room expiration for ${accessCode}:`, error);
  }
}

// Khởi tạo global checker (chạy ít thường xuyên hơn để backup)
function initializeGlobalExpirationChecker(io, rooms) {
  if (globalExpirationChecker) {
    clearInterval(globalExpirationChecker);
  }

  // Chỉ chạy 30 phút một lần để backup, vì đã có timeout riêng cho từng room
  globalExpirationChecker = setInterval(async () => {
    try {
      const now = new Date();
      const expiredSessions = await RoomSession.findAll({
        where: {
          expiredAt: { [Op.lt]: now },
          status: 'active'
        }
      });

      for (const session of expiredSessions) {
        await handleRoomExpiration(io, session.accessCode, rooms);
      }
    } catch (error) {
      logger.error('Error in global expiration checker:', error);
    }
  }, 30 * 60 * 1000); // 30 phút
}

// Hàm kiểm tra expiration khi có activity (lazy check)
async function checkRoomExpirationOnActivity(accessCode) {
  try {
    const roomSession = await RoomSession.findOne({
      where: { accessCode }
    });

    if (!roomSession || !roomSession.expiredAt) {
      return { isExpired: false };
    }

    const now = new Date();
    const isExpired = now > roomSession.expiredAt;

    return { 
      isExpired, 
      expiredAt: roomSession.expiredAt,
      roomSession 
    };
  } catch (error) {
    logger.error('Error checking room expiration:', error);
    return { isExpired: false };
  }
}

function handleRoomManagement(io, socket, rooms, userSessions) {
  // Khởi tạo global checker một lần duy nhất
  if (!globalExpirationChecker) {
    initializeGlobalExpirationChecker(io, rooms);
  }

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

      // Kiểm tra AccessCode có expired không
      const accessCodeData = await AccessCode.findOne({
        where: { code: accessCode }
      });

      if (!accessCodeData || accessCodeData.status === 'expired') {
        socket.emit('room_error', {
          error: 'Mã truy cập đã hết hạn',
          accessCode: accessCode
        });
        return;
      }

      // Lazy check expiration khi có activity
      const expirationCheck = await checkRoomExpirationOnActivity(accessCode);
      if (expirationCheck.isExpired) {
        await handleRoomExpiration(io, accessCode, rooms);
        socket.emit('room_error', {
          error: 'Phòng đã hết hạn sử dụng',
          accessCode: accessCode
        });
        return;
      }
      
      const now = new Date();
      
      let roomSession = expirationCheck.roomSession || await RoomSession.findOne({ where: { accessCode } });
      let isFirstTimeCreating = false;
      let isFirstDisplayConnection = false;
      
      if (!roomSession) {
        isFirstTimeCreating = true;
        
        const initialClientConnected = (clientType === 'admin' || clientType === 'client') ? [socket.id] : [];
        const initialDisplayConnected = (clientType === 'display') ? [socket.id] : [];
        
        let expiredAt = null;
        if (clientType === 'display') {
          isFirstDisplayConnection = true;
          expiredAt = new Date();
          expiredAt.setHours(expiredAt.getHours() + 2);
          logger.info(`First display connected, setting expiredAt to: ${expiredAt}`);
          
          // Tạo timeout cho room này
          scheduleRoomExpiration(io, accessCode, expiredAt, rooms);
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
        // Kiểm tra RoomSession có expired không
        if (roomSession.status === 'expired') {
          socket.emit('room_error', {
            error: 'Phòng đã hết hạn sử dụng',
            accessCode: accessCode
          });
          return;
        }

        const updateData = { lastActivityAt: now };
        
        if (clientType === 'admin' || clientType === 'client') {
          if (!roomSession.clientConnected.includes(socket.id)) {
            updateData.clientConnected = [...roomSession.clientConnected, socket.id];
          }
        } else if (clientType === 'display') {
          if (!roomSession.displayConnected.includes(socket.id)) {
            updateData.displayConnected = [...roomSession.displayConnected, socket.id];
            
            // Kiểm tra nếu đây là lần đầu tiên có display kết nối
            if (roomSession.displayConnected.length === 0) {
              isFirstDisplayConnection = true;
              const expiredAt = new Date();
              expiredAt.setHours(expiredAt.getHours() + 2);
              updateData.expiredAt = expiredAt;
              logger.info(`First display connected to existing room, setting expiredAt to: ${expiredAt}`);
              
              // Tạo timeout cho room này
              scheduleRoomExpiration(io, accessCode, expiredAt, rooms);
            } else if (roomSession.expiredAt) {
              // Nếu đã có expiredAt, đảm bảo timeout được tạo
              scheduleRoomExpiration(io, accessCode, roomSession.expiredAt, rooms);
            }
          }
        }
        
        await roomSession.update(updateData);
      }

      // Nếu là lần đầu tiên có display kết nối, cập nhật AccessCode status thành 'used'
      if (isFirstDisplayConnection) {
        await AccessCode.update(
          { 
            status: 'used',
            lastUsedAt: now,
            usageCount: sequelize.literal('usageCount + 1')
          },
          { where: { code: accessCode } }
        );
        logger.info(`AccessCode ${accessCode} marked as used due to first display connection`);
      }
      
      if (!rooms.has(accessCode)) {
        const newRoom = createNewRoom(accessCode);
        const loadedData = await loadRoomData(accessCode);
        const mergedRoom = mergeRoomDataWithState(newRoom, loadedData);
        rooms.set(accessCode, mergedRoom);
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
      
      const response = {
        accessCode: accessCode,
        roomId: `room_${accessCode}`,
        currentState: room.currentState,
        clientCount: room.clients.size + room.adminClients.size,
        isAdmin: clientType === 'admin',
        expiredAt: roomSession.expiredAt
      };
      
      socket.emit('room_joined', response);
      
      if (room.clients.size + room.adminClients.size > 1) { 
        const clientJoinedData = {
          clientId: socket.id,
          clientType: clientType,
          clientCount: room.clients.size + room.adminClients.size
        };
        
        socket.to(`room_${accessCode}`).emit('client_joined', clientJoinedData);
      }
      
      logger.info(`Client ${socket.id} joined room ${accessCode} as ${clientType}. Total clients: ${room.clients.size + room.adminClients.size}`);
      
    } catch (error) {
      logger.error('Error in join_room:', error);
      
      const errorResponse = {
        error: 'Lỗi khi tham gia phòng',
        details: error.message
      };
      
      socket.emit('room_error', errorResponse);
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
          
          // Clear timeout khi room bị xóa
          if (roomTimeouts.has(accessCode)) {
            clearTimeout(roomTimeouts.get(accessCode));
            roomTimeouts.delete(accessCode);
          }
          
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
        
        // Clear timeout khi room bị xóa
        if (roomTimeouts.has(accessCode)) {
          clearTimeout(roomTimeouts.get(accessCode));
          roomTimeouts.delete(accessCode);
        }
        
        logger.info(`Room ${accessCode} cleaned up (no more clients)`);
      }
      
      const userData = userSessions.get(socket.id);
      if (userData) {
        userData.currentRoom = null;
        userData.clientType = null;
      }
      
      const leaveResponse = {
        accessCode: accessCode,
        message: 'Đã rời phòng thành công'
      };
      
      socket.emit('room_left', leaveResponse);
      
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

// Cleanup function để clear tất cả timeouts khi server shutdown
function cleanupRoomTimeouts() {
  for (const [accessCode, timeoutId] of roomTimeouts.entries()) {
    clearTimeout(timeoutId);
    logger.info(`Cleared timeout for room: ${accessCode}`);
  }
  roomTimeouts.clear();
  
  if (globalExpirationChecker) {
    clearInterval(globalExpirationChecker);
    globalExpirationChecker = null;
  }
}

module.exports = { 
  handleRoomManagement, 
  cleanupRoomTimeouts,
  handleRoomExpiration 
};