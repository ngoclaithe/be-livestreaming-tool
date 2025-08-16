const logger = require('../utils/logger');
const { sequelize, RoomSession, Match, AccessCode, DisplaySetting, PlayerList } = require('../models');
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
        teamA: { name: "ĐỘI A", score: 0, scoreSet: 0, logo: null },
        teamB: { name: "ĐỘI B", score: 0, scoreSet: 0, logo: null },
        matchTime: "00:00",
        period: "Chưa bắt đầu",
        status: "waiting",
        tournament: "",
        stadium: "",
        matchDate: "",
        liveText: "",
        typeMatch: "" 
      },
      matchStats: {
        possession: { team1: 50, team2: 50 },
        totalShots: { team1: 0, team2: 0 },
        shotsOnTarget: { team1: 0, team2: 0 },
        corners: { team1: 0, team2: 0 },
        yellowCards: { team1: [], team2: [] },
        redCards: { team1: [], team2: [] },
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
          scoreSet: match.teamAScoreSet || 0,
          logo: match.teamALogo,
          kitColor: match.teamAkitcolor,
          kit2Color: match.teamA2kitcolor,
          scorers: match.teamAScorers || [],
          futsalFouls: match.teamAFutsalFoul || 0
        },
        teamB: {
          name: match.teamBName,
          score: match.awayScore,
          scoreSet: match.teamBScoreSet || 0,
          logo: match.teamBLogo,
          kitColor: match.teamBkitcolor,
          kit2Color: match.teamB2kitcolor,
          scorers: match.teamBScorers || [],
          futsalFouls: match.teamBFutsalFoul || 0
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
        liveText: match.live_unit,
        stats: {
          possession: {
            team1: match.teamAPossession || 50,
            team2: match.teamBPossession || 50
          },
          totalShots: {
            team1: match.teamAShots || 0,
            team2: match.teamBShots || 0
          },
          shotsOnTarget: {
            team1: match.teamAShotsOnTarget || 0,
            team2: match.teamBShotsOnTarget || 0
          },
          corners: {
            team1: match.teamACorners || 0,
            team2: match.teamBCorners || 0
          },
          yellowCards: {
            team1: match.teamAYellowCards || 0,
            team2: match.teamBYellowCards || 0
          },
          redCards: {
            team1: match.teamARedCards || 0,
            team2: match.teamBRedCards || 0
          },
          fouls: {
            team1: match.teamAFouls || 0,
            team2: match.teamBFouls || 0
          }
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
    // console.log("giá trị khi load xong match là:", match);
    // console.log("typeMatch từ database:", match.typeMatch);

    roomState.currentState.matchData = {
      teamA: {
        name: match.teamA.name,
        score: match.teamA.score,
        scoreSet: match.teamA.scoreSet || 0,
        logo: match.teamA.logo,
        teamAKitColor: match.teamA.kitColor,    
        teamA2KitColor: match.teamA.kit2Color,
        scorers: match.teamA.scorers || [],
        futsalFouls: match.teamA.futsalFouls || 0
      },
      teamB: {
        name: match.teamB.name,
        score: match.teamB.score,
        scoreSet: match.teamB.scoreSet || 0,
        logo: match.teamB.logo,
        teamBKitColor: match.teamB.kitColor,    
        teamB2KitColor: match.teamB.kit2Color,
        scorers: match.teamB.scorers || [],
        futsalFouls: match.teamB.futsalFouls || 0
      },
      matchTime: roomState.currentState.matchData.matchTime,
      period: roomState.currentState.matchData.period,
      status: match.status === 'live' ? 'live' : roomState.currentState.matchData.status,
      tournament: match.tournament,
      stadium: match.stadium,
      matchDate: match.matchDate ? new Date(match.matchDate).toLocaleDateString() : "",
      liveText: match.liveText || roomState.currentState.matchData.liveText,
      matchTitle: match.matchTitle || roomState.currentState.matchData.matchTitle || "",
      typeMatch: match.typeMatch || "" 
    };

    if (match.stats) {
      roomState.currentState.matchStats = {
        possession: {
          team1: match.stats.possession.team1 || 50,
          team2: match.stats.possession.team2 || 50
        },
        totalShots: {
          team1: match.stats.totalShots.team1 || 0,
          team2: match.stats.totalShots.team2 || 0
        },
        shotsOnTarget: {
          team1: match.stats.shotsOnTarget.team1 || 0,
          team2: match.stats.shotsOnTarget.team2 || 0
        },
        corners: {
          team1: match.stats.corners.team1 || 0,
          team2: match.stats.corners.team2 || 0
        },
        yellowCards: {
          team1: match.stats.yellowCards.team1 || [],  
          team2: match.stats.yellowCards.team2 || []   
        },
        redCards: {
          team1: match.stats.redCards.team1 || [],     
          team2: match.stats.redCards.team2 || []      
        },
        fouls: {
          team1: match.stats.fouls.team1 || 0,
          team2: match.stats.fouls.team2 || 0
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

function scheduleRoomExpiration(io, accessCode, expiredAt, rooms) {
  if (roomTimeouts.has(accessCode)) {
    clearTimeout(roomTimeouts.get(accessCode));
  }

  const now = new Date();
  const timeUntilExpired = expiredAt.getTime() - now.getTime();

  if (timeUntilExpired <= 0) {
    handleRoomExpiration(io, accessCode, rooms);
    return;
  }

  const timeoutId = setTimeout(() => {
    handleRoomExpiration(io, accessCode, rooms);
    roomTimeouts.delete(accessCode);
  }, timeUntilExpired);

  roomTimeouts.set(accessCode, timeoutId);
  logger.info(`Scheduled room expiration for ${accessCode} in ${Math.round(timeUntilExpired / 1000)} seconds`);
}

async function handleRoomExpiration(io, accessCode, rooms) {
  try {
    logger.info(`Processing room expiration for: ${accessCode}`);
    console.log(`Bắt đầu xử lý hết hạn cho phòng: ${accessCode}`);

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
    console.log(`Đã cập nhật trạng thái expired trong database cho phòng: ${accessCode}`);

    io.to(`room_${accessCode}`).emit('room_expired', {
      message: 'Phòng đã hết hạn sử dụng',
      accessCode: accessCode
    });
    console.log(`Đã gửi thông báo hết hạn đến các client trong phòng: ${accessCode}`);

    const sockets = await io.in(`room_${accessCode}`).fetchSockets();
    console.log(`Tìm thấy ${sockets.length} kết nối trong phòng ${accessCode} sẽ bị ngắt`);

    for (const socket of sockets) {
      console.log(`Đang ngắt kết nối socket ID: ${socket.id} trong phòng ${accessCode}`);
      socket.leave(`room_${accessCode}`);
      socket.disconnect(true);
      console.log(`Đã ngắt kết nối socket ID: ${socket.id}`);
    }

    if (rooms.has(accessCode)) {
      rooms.delete(accessCode);
      console.log(`Đã xóa phòng ${accessCode} khỏi bộ nhớ`);
    }

    if (roomTimeouts.has(accessCode)) {
      clearTimeout(roomTimeouts.get(accessCode));
      roomTimeouts.delete(accessCode);
      console.log(`Đã xóa timeout cho phòng ${accessCode}`);
    }

    logger.info(`Room ${accessCode} expired and cleaned up successfully`);
    console.log(`Hoàn thành xử lý hết hạn cho phòng ${accessCode}`);
  } catch (error) {
    logger.error(`Error handling room expiration for ${accessCode}:`, error);
    console.error(`Lỗi khi xử lý hết hạn cho phòng ${accessCode}:`, error);
  }
}

function initializeGlobalExpirationChecker(io, rooms) {
  if (globalExpirationChecker) {
    clearInterval(globalExpirationChecker);
  }

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
  }, 5 * 60 * 1000); 
}

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

      console.log('AccessCode status before join:', accessCodeData.status);

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

        if (isFirstDisplayConnection) {
          try {
            await AccessCode.update(
              {
                status: 'used',
                lastUsedAt: now,
                usageCount: sequelize.literal('"usageCount" + 1'),
                expiredAt: expiredAt
              },
              {
                where: { code: accessCode },
                returning: true
              }
            );
            logger.info(`AccessCode ${accessCode} marked as used with expiredAt: ${expiredAt} (new room)`);
            console.log("Giá trị của expiredAt là (new room):", expiredAt);
          } catch (updateError) {
            logger.error(`ERROR updating AccessCode ${accessCode} (new room):`, updateError);
          }
        }

      } else {
        if (roomSession.status === 'expired') {
          socket.emit('room_error', {
            error: 'Phòng đã hết hạn sử dụng',
            accessCode: accessCode
          });
          return;
        }

        console.log('Current displayConnected before update:', roomSession.displayConnected);
        console.log('Display count before update:', roomSession.displayConnected.length);

        const updateData = { lastActivityAt: now };

        if (clientType === 'admin' || clientType === 'client') {
          if (!roomSession.clientConnected.includes(socket.id)) {
            updateData.clientConnected = [...roomSession.clientConnected, socket.id];
          }
        } else if (clientType === 'display') {
          if (!roomSession.displayConnected.includes(socket.id)) {
            updateData.displayConnected = [...roomSession.displayConnected, socket.id];

            const currentDisplayCount = roomSession.displayConnected.length;
            if (currentDisplayCount === 0 && roomSession.expiredAt === null) {
              isFirstDisplayConnection = true;
              const expiredAt = new Date();
              expiredAt.setHours(expiredAt.getHours() + 2);
              updateData.expiredAt = expiredAt;
              logger.info(`First display connected to existing room, setting expiredAt to: ${expiredAt}`);

              scheduleRoomExpiration(io, accessCode, expiredAt, rooms);

              try {
                const currentAccessCode = await AccessCode.findOne({ where: { code: accessCode } });
                if (currentAccessCode && currentAccessCode.expiredAt === null) {
                  await AccessCode.update(
                    {
                      status: 'used',
                      lastUsedAt: now,
                      usageCount: sequelize.literal('"usageCount" + 1'),
                      expiredAt: expiredAt
                    },
                    { where: { code: accessCode } }
                  );
                  logger.info(`AccessCode ${accessCode} marked as used with expiredAt: ${expiredAt} (existing room)`);
                  console.log("Giá trị của expiredAt là (existing room):", expiredAt);
                } else {
                  logger.info(`AccessCode ${accessCode} already has expiredAt set, skipping update`);
                  console.log("AccessCode đã có expiredAt, không update:", currentAccessCode.expiredAt);
                }
              } catch (updateError) {
                logger.error(`ERROR updating AccessCode ${accessCode} (existing room):`, updateError);
              }
            } else if (roomSession.expiredAt) {
              scheduleRoomExpiration(io, accessCode, roomSession.expiredAt, rooms);
              logger.info(`Room ${accessCode} already has expiredAt: ${roomSession.expiredAt}, rescheduling timeout only`);
            }
          }
        }

        await roomSession.update(updateData);
      }

      if (!rooms.has(accessCode)) {
        const newRoom = createNewRoom(accessCode);
        const loadedData = await loadRoomData(accessCode);
        const mergedRoom = mergeRoomDataWithState(newRoom, loadedData);
        rooms.set(accessCode, mergedRoom);
        logger.info(`Created new room ${accessCode} with loaded data from database`);
      } else {
        if (accessCodeData.status === 'active' || accessCodeData.status === 'used') {
          const room = rooms.get(accessCode);
          const loadedData = await loadRoomData(accessCode);
          // console.log("Giá trị của loadedData là", loadedData);

          const updatedRoom = mergeRoomDataWithState(room, loadedData);
          // console.log("Giá trị của updatedRoom là", updatedRoom);
          rooms.set(accessCode, updatedRoom);
          // console.log("Giá trị của rooms sau khi cập nhật updatedRoom là", rooms);

          socket.to(`room_${accessCode}`).emit('room_data_updated', {
            currentState: updatedRoom.currentState,
            message: 'Dữ liệu phòng đã được cập nhật từ database'
          });
        }
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
        expiredAt: roomSession.expiredAt,
        dataSynced: accessCodeData.status === 'active' || accessCodeData.status === 'used',
        typeMatch: room.currentState.matchData.typeMatch 
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

      // console.log('=== ROOM_JOINED EVENT DATA ===');
      // console.log('Room:', accessCode);
      // console.log('Client Type:', clientType);
      // console.log('Socket ID:', socket.id);
      // console.log('Room State:', {
      //   matchData: room.currentState.matchData,
      //   displaySettings: room.currentState.displaySettings,
      //   view: room.currentState.view,
      //   timestamp: new Date().toISOString()
      // });
      // console.log('=============================');

      logger.info(`Client ${socket.id} joined room ${accessCode} as ${clientType}. Total clients: ${room.clients.size + room.adminClients.size}. TypeMatch: ${room.currentState.matchData.typeMatch}`);

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
          rooms.delete(accessCode);

          logger.info(`Room ${accessCode} removed from memory (no clients), but RoomSession preserved in database until expiration`);
        } catch (error) {
          logger.error('Error removing room from memory:', error);
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
        rooms.delete(accessCode);
        logger.info(`Room ${accessCode} removed from memory (no more clients), but RoomSession preserved until expiration`);
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