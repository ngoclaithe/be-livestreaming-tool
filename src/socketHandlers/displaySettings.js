const logger = require('../utils/logger');
const { DisplaySetting } = require('../models');

function cleanLogoUrl(logoUrl) {
    if (!logoUrl || typeof logoUrl !== 'string') {
        return logoUrl;
    }

    const patterns = [
        /^https?:\/\/[^\/]+\/api\/v1(\/.+)$/,  // Matches http://... or https://... with any domain/IP
    ];

    for (const pattern of patterns) {
        const match = logoUrl.match(pattern);
        if (match) {
            return `/api/v1${match[1]}`;
        }
    }

    return logoUrl;
}

async function updateDisplaySettings(accessCode, type, items) {
  try {
    const displaySettings = [];
    const codeLogos = Array.isArray(items.code_logo) ? items.code_logo : [];
    const urlLogos = Array.isArray(items.url_logo) ? items.url_logo : [];
    const positions = Array.isArray(items.position) ? items.position : [];
    const typeDisplays = Array.isArray(items.type_display) ? items.type_display : [];

    const maxLength = Math.max(
      codeLogos.length,
      urlLogos.length,
      positions.length,
      typeDisplays.length
    );

    for (let i = 0; i < maxLength; i++) {
      if (codeLogos[i] && urlLogos[i] && positions[i]) {
        const processedUrlLogo = cleanLogoUrl(urlLogos[i]);

        const existingRecord = await DisplaySetting.findOne({
          where: {
            accessCode,
            code_logo: codeLogos[i],
            type: type
          }
        });

        if (!existingRecord) {
          displaySettings.push({
            type: type,
            code_logo: codeLogos[i],
            position: positions[i],
            url_logo: processedUrlLogo,
            type_display: typeDisplays[i] || 'default',
            accessCode: accessCode
          });
        } else {
          if (existingRecord.url_logo !== processedUrlLogo) {
            await existingRecord.update({ url_logo: processedUrlLogo });
          }
        }
      }
    }

    if (displaySettings.length > 0) {
      await DisplaySetting.bulkCreate(displaySettings);
    } else {
      console.log('ℹ️ Không có bản ghi mới nào được thêm vào');
    }

    return true;
  } catch (error) {
    console.error(`❌ Lỗi khi cập nhật cài đặt hiển thị cho ${type}:`, error);
    throw error;
  }
}

function handleDisplaySettings(io, socket, rooms, userSessions) {
  socket.on('display_settings_update', (data) => {    
    try {
      const { accessCode, displaySettings, timestamp = Date.now() } = data;     
      if (!accessCode || !displaySettings) {
        throw new Error('Access code and display settings data are required');
      }
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      const isAdmin = userData && room.adminClients.has(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update display settings');
      }
      
      if (!room.currentState.displaySettings) {
        room.currentState.displaySettings = {
          logoShape: 'square',  // Default value
          rotateDisplay: false  // Default value
        };
      }
      
      // Update display settings
      if (displaySettings.logoShape !== undefined) {
        room.currentState.displaySettings.logoShape = displaySettings.logoShape;
      }
      if (displaySettings.rotateDisplay !== undefined) {
        room.currentState.displaySettings.rotateDisplay = displaySettings.rotateDisplay;
      }
      
      room.lastActivity = timestamp;
      
      io.to(`room_${accessCode}`).emit('display_settings_updated', {
        displaySettings: room.currentState.displaySettings,
        timestamp: timestamp
      });
      console.log("✅ Đã cập nhật và gửi lại dữ liệu display settings", displaySettings);
      
    } catch (error) {
      console.error('❌ Error in display_settings_update:', error.message);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Sponsors update
  socket.on('sponsors_update', async (data) => {
    console.log('📨 Received sponsors_update:', data);
    
    try {
      const { accessCode, sponsors, timestamp = Date.now() } = data;     
      if (!accessCode || !sponsors) {
        throw new Error('Access code and sponsors data are required');
      }
      
      const behavior = sponsors.behavior || 'add';
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update sponsors');
      }
      
      // Khởi tạo sponsors nếu chưa có
      if (!room.currentState.sponsors) {
        room.currentState.sponsors = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
      fields.forEach(field => {
        if (sponsors[field] !== undefined) {
          room.currentState.sponsors[field] = Array.isArray(sponsors[field]) 
            ? [...sponsors[field]] 
            : [];
        }
      });
      
      room.lastActivity = timestamp;
      if (behavior === 'remove') {
        
        try {
          await DisplaySetting.destroy({
            where: {
              accessCode,
              type: 'sponsors',
              code_logo: sponsors.code_logo?.[0] 
            }
          });
        } catch (error) {
          console.error('❌ Lỗi khi xóa sponsor khỏi database:', error.message);
          throw error;
        }
      } else if (behavior === 'update') {
        // Cập nhật vị trí trong database
        try {
          await DisplaySetting.update(
            { position: sponsors.position?.[0] },
            {
              where: {
                accessCode,
                type: 'sponsors',
                code_logo: sponsors.code_logo?.[0]
              }
            }
          );
        } catch (error) {
          console.error('❌ Lỗi khi cập nhật vị trí sponsor trong database:', error.message);
          throw error;
        }
      } else if (behavior === 'add') {
        // Thêm vào database
        try {
          await updateDisplaySettings(accessCode, 'sponsors', room.currentState.sponsors);
        } catch (error) {
          console.error('❌ Lỗi khi lưu sponsors vào database:', error.message);
          throw error;
        }
      }
      
      // Phát lại cho tất cả client trong phòng
      io.to(`room_${accessCode}`).emit('sponsors_updated', {
        sponsors: room.currentState.sponsors,
        behavior: behavior,
        timestamp: timestamp
      });
      
      console.log('✅ Đã cập nhật và gửi lại dữ liệu sponsors');
      
    } catch (error) {
      console.error('❌ Lỗi trong sponsors_update:', error.message);
      socket.emit('error', { 
        event: 'sponsors_update', 
        message: error.message 
      });
    }
  });

  // Organizing update
  socket.on('organizing_update', async (data) => {
    console.log('📨 Received organizing_update:', data);
    
    try {
      const { accessCode, organizing, timestamp = Date.now() } = data;     
      if (!accessCode || !organizing) {
        throw new Error('Access code and organizing data are required');
      }
      
      // Lấy behavior từ organizing nếu có, nếu không thì mặc định là 'add'
      const behavior = organizing.behavior || 'add';
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update organizing');
      }
      
      // Khởi tạo organizing nếu chưa có
      if (!room.currentState.organizing) {
        room.currentState.organizing = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      // Cập nhật từng trường nếu được cung cấp
      const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
      fields.forEach(field => {
        if (organizing[field] !== undefined) {
          room.currentState.organizing[field] = Array.isArray(organizing[field])
            ? [...organizing[field]]
            : [];
        }
      });
      
      room.lastActivity = timestamp;
      
      // Xử lý dựa trên behavior
      if (behavior === 'remove') {
        // Xóa khỏi database
        try {
          await DisplaySetting.destroy({
            where: {
              accessCode,
              type: 'organizing',
              code_logo: organizing.code_logo?.[0] // Giả sử chỉ xóa một mục mỗi lần
            }
          });
        } catch (error) {
          console.error('❌ Lỗi khi xóa organizing khỏi database:', error.message);
          throw error;
        }
      } else if (behavior === 'update') {
        // Cập nhật vị trí trong database
        try {
          await DisplaySetting.update(
            { position: organizing.position?.[0] },
            {
              where: {
                accessCode,
                type: 'organizing',
                code_logo: organizing.code_logo?.[0]
              }
            }
          );
        } catch (error) {
          console.error('❌ Lỗi khi cập nhật vị trí organizing trong database:', error.message);
          throw error;
        }
      } else if (behavior === 'add') {
        // Thêm vào database
        try {
          await updateDisplaySettings(accessCode, 'organizing', room.currentState.organizing);
        } catch (error) {
          console.error('❌ Lỗi khi lưu organizing vào database:', error.message);
          throw error;
        }
      }
      
      // Phát lại cho tất cả client trong phòng
      io.to(`room_${accessCode}`).emit('organizing_updated', {
        organizing: room.currentState.organizing,
        behavior: behavior,
        timestamp: timestamp
      });
      
      console.log('✅ Đã cập nhật và gửi lại dữ liệu organizing');
      console.log("Giá trị trả về organizing_updated:", room.currentState.organizing);
      console.log("Giá trị behavior:", behavior);
    } catch (error) {
      console.error('❌ Lỗi trong organizing_update:', error.message);
      socket.emit('error', {
        event: 'organizing_update',
        message: error.message
      });
    }
  });

  // Media partners update
  socket.on('media_partners_update', async (data) => {
    console.log('📨 Received media_partners_update:', data);
    
    try {
      // Chấp nhận cả media_partners và mediaPartners
      const { accessCode, media_partners = data.mediaPartners, timestamp = Date.now() } = data;     
      if (!accessCode || !media_partners) {
        throw new Error('Access code and media_partners data are required');
      }
      
      // Lấy behavior từ media_partners nếu có, nếu không thì mặc định là 'add'
      const behavior = media_partners.behavior || 'add';
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update media partners');
      }
      
      // Khởi tạo media_partners nếu chưa có
      if (!room.currentState.media_partners) {
        room.currentState.media_partners = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      // Cập nhật từng trường nếu được cung cấp
      const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
      fields.forEach(field => {
        if (media_partners[field] !== undefined) {
          room.currentState.media_partners[field] = Array.isArray(media_partners[field])
            ? [...media_partners[field]]
            : [];
        }
      });
      
      room.lastActivity = timestamp;
      
      // Xử lý dựa trên behavior
      if (behavior === 'remove') {
        // Xóa khỏi database
        try {
          await DisplaySetting.destroy({
            where: {
              accessCode,
              type: 'media_partners',
              code_logo: media_partners.code_logo?.[0] // Giả sử chỉ xóa một mục mỗi lần
            }
          });
        } catch (error) {
          console.error('❌ Lỗi khi xóa media_partners khỏi database:', error.message);
          throw error;
        }
      } else if (behavior === 'update') {
        // Cập nhật vị trí trong database
        try {
          await DisplaySetting.update(
            { position: media_partners.position?.[0] },
            {
              where: {
                accessCode,
                type: 'media_partners',
                code_logo: media_partners.code_logo?.[0]
              }
            }
          );
        } catch (error) {
          console.error('❌ Lỗi khi cập nhật vị trí media_partners trong database:', error.message);
          throw error;
        }
      } else if (behavior === 'add') {
        // Thêm vào database
        try {
          await updateDisplaySettings(accessCode, 'media_partners', room.currentState.media_partners);
        } catch (error) {
          console.error('❌ Lỗi khi lưu media_partners vào database:', error.message);
          throw error;
        }
      }
      
      // Phát lại cho tất cả client trong phòng, sử dụng mediaPartner thay vì media_partners
      io.to(`room_${accessCode}`).emit('media_partners_updated', {
        mediaPartners: room.currentState.media_partners,
        behavior: behavior,
        timestamp: timestamp
      });
      
      console.log('✅ Đã cập nhật và gửi lại dữ liệu media partners');
      console.log("Giá trị trả về media_partners_updated:", room.currentState.media_partners);
      
    } catch (error) {
      console.error('❌ Lỗi trong media_partners_update:', error.message);
      socket.emit('error', {
        event: 'media_partners_update',
        message: error.message
      });
    }
  });

  // Tournament logo update
  socket.on('tournament_logo_update', async (data) => {
    console.log('📨 Received tournament_logo_update:', data);
    
    try {
      // Handle both tournament_logo and tournamentLogo property names
      const { accessCode, tournament_logo, tournamentLogo, timestamp = Date.now() } = data;     
      const tournamentLogoData = tournament_logo || tournamentLogo;
      
      if (!accessCode || !tournamentLogoData) {
        throw new Error('Access code and tournament logo data are required');
      }
      
      const behavior = tournamentLogoData.behavior || 'add';
      
      const room = rooms.get(accessCode);
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const userData = userSessions.get(socket.id);
      
      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update tournament logo');
      }
      
      if (!room.currentState.tournament_logo) {
        room.currentState.tournament_logo = {
          code_logo: [],
          url_logo: [],
          position: [],
          type_display: []
        };
      }
      
      // Update each field if provided
      const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
      fields.forEach(field => {
        if (tournamentLogoData[field] !== undefined) {
          room.currentState.tournament_logo[field] = Array.isArray(tournamentLogoData[field])
            ? [...tournamentLogoData[field]]
            : [];
        }
      });
      
      room.lastActivity = timestamp;
      
      // Xử lý dựa trên behavior
      if (behavior === 'remove') {
        // Xóa khỏi database
        try {
          await DisplaySetting.destroy({
            where: {
              accessCode,
              type: 'tournament_logo',
              code_logo: tournamentLogoData.code_logo?.[0] 
            }
          });
        } catch (error) {
          console.error('❌ Lỗi khi xóa tournament_logo khỏi database:', error.message);
          throw error;
        }
      } else if (behavior === 'update') {
        try {
          await DisplaySetting.update(
            { position: tournamentLogoData.position?.[0] },
            {
              where: {
                accessCode,
                type: 'tournament_logo',
                code_logo: tournamentLogoData.code_logo?.[0]
              }
            }
          );
        } catch (error) {
          console.error('❌ Lỗi khi cập nhật vị trí tournament_logo trong database:', error.message);
          throw error;
        }
      } else if (behavior === 'add') {
        try {
          await updateDisplaySettings(accessCode, 'tournament_logo', room.currentState.tournament_logo);
        } catch (error) {
          console.error('❌ Lỗi khi lưu tournament_logo vào database:', error.message);
          throw error;
        }
      }
      
      io.to(`room_${accessCode}`).emit('tournament_logo_updated', {
        tournamentLogo: room.currentState.tournament_logo,
        behavior: behavior,
        timestamp: timestamp
      });
      
      console.log('✅ Đã cập nhật và gửi lại dữ liệu tournament logo');
      console.log("Giá trị trả về tournament_logo_updated:", room.currentState.tournament_logo);
      
    } catch (error) {
      console.error('❌ Error in tournament_logo_update:', error.message);
    }
  });

  // Live unit update
  // socket.on('live_unit_update', (data) => {
    
  //   try {
  //     const { accessCode, live_unit, timestamp = Date.now() } = data;     
  //     if (!accessCode || !live_unit) {
  //       throw new Error('Access code and live_unit data are required');
  //     }
      
  //     const room = rooms.get(accessCode);
      
  //     if (!room) {
  //       throw new Error('Room not found');
  //     }
      
  //     const userData = userSessions.get(socket.id);
  //     const isAdmin = userData && room.adminClients.has(socket.id);
      
  //     if (!userData || !room.adminClients.has(socket.id)) {
  //       throw new Error('Unauthorized: Only admin can update live_unit');
  //     }
      
  //     if (!room.currentState.live_unit) {
  //       room.currentState.live_unit = {
  //         code_logo: [],
  //         url_logo: [],
  //         position: [],
  //         type_display: []
  //       };
  //     }
      
  //     if (live_unit.code_logo !== undefined) {
  //       room.currentState.live_unit.code_logo = live_unit.code_logo || [];
  //     }
  //     if (live_unit.url_logo !== undefined) {
  //       room.currentState.live_unit.url_logo = live_unit.url_logo || [];
  //     }
  //     if (live_unit.position !== undefined) {
  //       room.currentState.live_unit.position = live_unit.position || [];
  //     }
  //     if (live_unit.type_display !== undefined) {
  //       room.currentState.live_unit.type_display = live_unit.type_display || [];
  //     }
      
  //     room.lastActivity = timestamp;
      
  //     // Broadcast to all clients in the room
  //     io.to(`room_${accessCode}`).emit('live_unit_updated', {
  //       live_unit: room.currentState.live_unit,
  //       timestamp: timestamp
  //     });
      
  //     // console.log('📤 Broadcasted to room:', accessCode);
      
      
  //   } catch (error) {
  //     console.error('❌ Error in live_unit_update:', error.message);
  //   }
  // });

  // General match info update (tournament, stadium, etc.)
  socket.on('match_info_update', (data) => {
    console.log("Giá trị match_info_update là:", data);
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