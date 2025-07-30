const logger = require('../utils/logger');

function handleDisplaySettings(io, socket, rooms, userSessions) {
  
  // Sponsors update
  socket.on('sponsors_update', (data) => {
    console.log('📨 Received sponsors_update:', data);
    
    try {
      const { accessCode, sponsors, timestamp = Date.now() } = data;     
      if (!accessCode || !sponsors) {
        throw new Error('Access code and sponsors data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update sponsors');
      }
      
      if (!room.currentState.sponsors) {
        room.currentState.sponsors = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      if (sponsors.code_logo !== undefined) {
        room.currentState.sponsors.code_logo = sponsors.code_logo || [];
      }
      if (sponsors.url_logo !== undefined) {
        room.currentState.sponsors.url_logo = sponsors.url_logo || [];
      }
      if (sponsors.position !== undefined) {
        room.currentState.sponsors.position = sponsors.position || [];
      }
      if (sponsors.type_display !== undefined) {
        room.currentState.sponsors.type_display = sponsors.type_display || [];
      }
      
      room.lastActivity = timestamp;
      
      io.to(`room_${accessCode}`).emit('sponsors_updated', {
        sponsors: room.currentState.sponsors,
        timestamp: timestamp
      });
      
      console.log('📤 Broadcasted to room:', accessCode);
      
    } catch (error) {
      console.error('❌ Error in sponsors_update:', error.message);
    }
  });

  // Organizing update
  socket.on('organizing_update', (data) => {
    console.log('📨 Received organizing_update:', data);
    
    try {
      const { accessCode, organizing, timestamp = Date.now() } = data;     
      if (!accessCode || !organizing) {
        throw new Error('Access code and organizing data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update organizing');
      }
      
      if (!room.currentState.organizing) {
        room.currentState.organizing = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      if (organizing.code_logo !== undefined) {
        room.currentState.organizing.code_logo = organizing.code_logo || [];
      }
      if (organizing.url_logo !== undefined) {
        room.currentState.organizing.url_logo = organizing.url_logo || [];
      }
      if (organizing.position !== undefined) {
        room.currentState.organizing.position = organizing.position || [];
      }
      if (organizing.type_display !== undefined) {
        room.currentState.organizing.type_display = organizing.type_display || [];
      }
      
      room.lastActivity = timestamp;
      
      io.to(`room_${accessCode}`).emit('organizing_updated', {
        organizing: room.currentState.organizing,
        timestamp: timestamp
      });
      
      console.log('📤 Broadcasted to room:', accessCode);
      
    } catch (error) {
      console.error('❌ Error in organizing_update:', error.message);
    }
  });

  // Media partners update
  socket.on('media_partners_update', (data) => {
    console.log('📨 Received media_partners_update:', data);
    
    try {
      const { accessCode, media_partners, timestamp = Date.now() } = data;     
      if (!accessCode || !media_partners) {
        throw new Error('Access code and media_partners data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update media_partners');
      }
      
      if (!room.currentState.media_partners) {
        room.currentState.media_partners = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      if (media_partners.code_logo !== undefined) {
        room.currentState.media_partners.code_logo = media_partners.code_logo || [];
      }
      if (media_partners.url_logo !== undefined) {
        room.currentState.media_partners.url_logo = media_partners.url_logo || [];
      }
      if (media_partners.position !== undefined) {
        room.currentState.media_partners.position = media_partners.position || [];
      }
      if (media_partners.type_display !== undefined) {
        room.currentState.media_partners.type_display = media_partners.type_display || [];
      }
      
      room.lastActivity = timestamp;
      
      io.to(`room_${accessCode}`).emit('media_partners_updated', {
        media_partners: room.currentState.media_partners,
        timestamp: timestamp
      });
      
      console.log('📤 Broadcasted to room:', accessCode);
      
    } catch (error) {
      console.error('❌ Error in media_partners_update:', error.message);
    }
  });

  // Tournament logo update
  socket.on('tournament_logo_update', (data) => {
    console.log('📨 Received tournament_logo_update:', data);
    
    try {
      const { accessCode, tournament_logo, timestamp = Date.now() } = data;     
      if (!accessCode || !tournament_logo) {
        throw new Error('Access code and tournament_logo data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update tournament_logo');
      }
      
      if (!room.currentState.tournament_logo) {
        room.currentState.tournament_logo = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      if (tournament_logo.code_logo !== undefined) {
        room.currentState.tournament_logo.code_logo = tournament_logo.code_logo || [];
      }
      if (tournament_logo.url_logo !== undefined) {
        room.currentState.tournament_logo.url_logo = tournament_logo.url_logo || [];
      }
      if (tournament_logo.position !== undefined) {
        room.currentState.tournament_logo.position = tournament_logo.position || [];
      }
      if (tournament_logo.type_display !== undefined) {
        room.currentState.tournament_logo.type_display = tournament_logo.type_display || [];
      }
      
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('tournament_logo_updated', {
        tournament_logo: room.currentState.tournament_logo,
        timestamp: timestamp
      });
      
      console.log('📤 Broadcasted to room:', accessCode);
      
    } catch (error) {
      console.error('❌ Error in tournament_logo_update:', error.message);
    }
  });

  // Live unit update
  socket.on('live_unit_update', (data) => {
    console.log('📨 Received live_unit_update:', data);
    
    try {
      const { accessCode, live_unit, timestamp = Date.now() } = data;     
      if (!accessCode || !live_unit) {
        throw new Error('Access code and live_unit data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update live_unit');
      }
      
      if (!room.currentState.live_unit) {
        room.currentState.live_unit = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      if (live_unit.code_logo !== undefined) {
        room.currentState.live_unit.code_logo = live_unit.code_logo || [];
      }
      if (live_unit.url_logo !== undefined) {
        room.currentState.live_unit.url_logo = live_unit.url_logo || [];
      }
      if (live_unit.position !== undefined) {
        room.currentState.live_unit.position = live_unit.position || [];
      }
      if (live_unit.type_display !== undefined) {
        room.currentState.live_unit.type_display = live_unit.type_display || [];
      }
      
      room.lastActivity = timestamp;
      
      // Broadcast to all clients in the room
      io.to(`room_${accessCode}`).emit('live_unit_updated', {
        live_unit: room.currentState.live_unit,
        timestamp: timestamp
      });
      
      console.log('📤 Broadcasted to room:', accessCode);
      
    } catch (error) {
      console.error('❌ Error in live_unit_update:', error.message);
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
      
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update match info');
      }
      
      const fieldsToUpdate = [
        'tournament', 'stadium', 'matchDate', 'liveText', 'startTime'
      ];
      
      fieldsToUpdate.forEach(field => {
        if (matchInfo[field] !== undefined) {
          room.currentState.matchData[field] = matchInfo[field];
        }
      });
      
      if (matchInfo.time !== undefined) {
        room.currentState.matchData.startTime = matchInfo.time;
      }
      
      room.lastActivity = timestamp;
      
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
      
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can toggle stats');
      }
      
      room.currentState.displaySettings.showStats = Boolean(show);
      room.lastActivity = timestamp;
      
      io.to(`room_${accessCode}`).emit('stats_toggled', {
        show: room.currentState.displaySettings.showStats,
        timestamp: timestamp
      });
      
      logger.info(`Stats display toggled to ${show} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in toggle_stats:', error);
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
      
      const userData = userSessions.get(socket.id);
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can toggle penalty');
      }
      
      room.currentState.displaySettings.showPenalty = Boolean(show);
      room.lastActivity = timestamp;
      
      if (show && !room.currentState.penaltyData) {
        room.currentState.penaltyData = {
          homeGoals: 0,
          awayGoals: 0,
          currentTurn: 'home',
          shootHistory: [],
          status: 'ready'
        };
      }
      
      io.to(`room_${accessCode}`).emit('penalty_toggled', {
        show: room.currentState.displaySettings.showPenalty,
        penaltyData: room.currentState.penaltyData,
        timestamp: timestamp
      });
      
      logger.info(`Penalty display toggled to ${show} for room ${accessCode}`);
      
    } catch (error) {
      logger.error('Error in toggle_penalty:', error);
    }
  });
}

module.exports = { handleDisplaySettings };