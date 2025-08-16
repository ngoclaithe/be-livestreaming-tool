const logger = require('../utils/logger');
const { DisplaySetting, Match, AccessCode } = require('../models');

function cleanLogoUrl(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') {
    return logoUrl;
  }

  const pattern = /^https?:\/\/[^\/]+\/api\/v1(\/.+)$/;

  const match = logoUrl.match(pattern);
  if (match) {
    return match[1];
  }

  return logoUrl;
}

async function updateMatchInfo(accessCode, matchInfo) {
  try {
    const accessCodeData = await AccessCode.findOne({
      where: { code: accessCode },
      include: [{
        model: Match,
        as: 'match',
        required: false
      }]
    });

    if (!accessCodeData || !accessCodeData.match) {
      throw new Error('Match not found for this access code');
    }

    const match = accessCodeData.match;
    const updates = {};

    // Ánh xạ các trường từ matchInfo sang model Match
    if (matchInfo.tournament !== undefined) {
      updates.tournamentName = matchInfo.tournament;
    }
    if (matchInfo.stadium !== undefined) {
      updates.venue = matchInfo.stadium;
      updates.location = matchInfo.stadium;
    }
    if (matchInfo.matchDate !== undefined) {
      updates.matchDate = new Date(matchInfo.matchDate);
    }
    if (matchInfo.liveText !== undefined) {
      updates.live_unit = matchInfo.liveText;
    }
    if (matchInfo.startTime !== undefined) {
      // Xử lý thời gian nếu cần
    }
    if (matchInfo.matchTitle !== undefined) {
      updates.match_title = matchInfo.matchTitle;
    }
    if (matchInfo.teamAkitcolor !== undefined || matchInfo.teamAKitColor !== undefined) {
      updates.teamAkitcolor = matchInfo.teamAkitcolor || matchInfo.teamAKitColor;
    }
    if (matchInfo.teamBkitcolor !== undefined || matchInfo.teamBKitColor !== undefined) {
      updates.teamBkitcolor = matchInfo.teamBkitcolor || matchInfo.teamBKitColor;
    }
    if (matchInfo.teamA2KitColor !== undefined) {
      updates.teamA2kitcolor = matchInfo.teamA2KitColor;
    }
    if (matchInfo.teamB2KitColor !== undefined) {
      updates.teamB2kitcolor = matchInfo.teamB2KitColor;
    }

    // Chỉ update nếu có thay đổi
    if (Object.keys(updates).length > 0) {
      await match.update(updates);
      logger.info(`Updated match ${match.id} with new info`, updates);
    }
    // console.log("Giá trị của match là", match);
    return match;
  } catch (error) {
    logger.error('Error updating match info:', error);
    throw error;
  }
};

async function updateDisplaySettings(accessCode, type, items) {
  try {
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

    console.log('🔄 Bắt đầu xử lý dữ liệu...');
    
    // Tạo mảng để lưu các promise cập nhật
    const updatePromises = [];
    
    for (let i = 0; i < maxLength; i++) {
      const codeLogo = codeLogos[i];
      const urlLogo = urlLogos[i];
      const position = positions[i] || 0;
      // Đảm bảo type_display luôn là 'logo' cho tournament_logo
      const typeDisplay = type === 'tournament_logo' ? 'logo' : (typeDisplays[i] || 'default');

      console.log(`\n🔍 Xử lý item ${i + 1}/${maxLength}:`);
      console.log(`- code_logo: ${codeLogo}`);
      console.log(`- url_logo: ${urlLogo}`);
      console.log(`- position: ${position}`);
      console.log(`- type_display: ${typeDisplay}`);

      if (codeLogo && urlLogo) {
        const processedUrlLogo = cleanLogoUrl(urlLogo);
        
        // Tạo đối tượng dữ liệu để cập nhật
        const updateData = {
          accessCode,
          type,
          code_logo: codeLogo,
          url_logo: processedUrlLogo,
          position: position,
          type_display: typeDisplay,
          data: {}
        };
        
        // Thêm các trường dữ liệu tùy chọn
        const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
        fields.forEach(field => {
          if (items[field] !== undefined) {
            console.log(`   - Cập nhật ${field}: ${JSON.stringify(items[field])}`);
            updateData.data[field] = items[field];
          }
        });
        
        // Sử dụng upsert để cập nhật hoặc tạo mới
        console.log('💾 Đang cập nhật hoặc tạo mới bản ghi...');
        const promise = DisplaySetting.upsert(updateData, {
          where: {
            accessCode,
            type,
            code_logo: codeLogo
          },
          returning: true
        });
        
        updatePromises.push(promise);
      }
    }
    
    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      console.log(`✅ Đã cập nhật thành công ${results.length} bản ghi`);
    } else {
      console.log('ℹ️ Không có dữ liệu nào cần cập nhật');
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
          logoShape: 'square',  
          rotateDisplay: false  
        };
      }

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
    console.log('📨 Received tournament_logo_update:', JSON.stringify(data, null, 2));

    try {
      const { accessCode, tournament_logo, tournamentLogo, timestamp = Date.now() } = data;
      const tournamentLogoData = tournament_logo || tournamentLogo;

      if (!accessCode || !tournamentLogoData) {
        console.error('❌ Lỗi: Thiếu accessCode hoặc tournamentLogoData');
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

      const fields = ['code_logo', 'url_logo', 'position', 'type_display'];
      fields.forEach(field => {
        if (tournamentLogoData[field] !== undefined) {
          console.log(`   - Cập nhật ${field}: ${JSON.stringify(tournamentLogoData[field])}`);
          room.currentState.tournament_logo[field] = Array.isArray(tournamentLogoData[field])
            ? [...tournamentLogoData[field]]
            : [];
        }
      });

      room.lastActivity = timestamp;

      if (behavior === 'remove') {
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

  socket.on('match_info_update', async (data) => {
    // console.log("Giá trị match_info_update là:", data);
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
  
      // Cập nhật database trước
      const updatedMatch = await updateMatchInfo(accessCode, matchInfo);
      console.log("🔍 updatedMatch từ database:", {
        teamAkitcolor: updatedMatch.teamAkitcolor,
        teamBkitcolor: updatedMatch.teamBkitcolor,  
        teamA2kitcolor: updatedMatch.teamA2kitcolor,
        teamB2kitcolor: updatedMatch.teamB2kitcolor
      });
  

      const regularFields = ['tournament', 'stadium', 'matchDate', 'liveText', 'startTime', 'matchTitle'];
      regularFields.forEach(field => {
        if (matchInfo[field] !== undefined) {
          room.currentState.matchData[field] = matchInfo[field];
        }
      });
  
      if (updatedMatch.teamAkitcolor !== undefined) {
        room.currentState.matchData.teamA.teamAKitColor = updatedMatch.teamAkitcolor;
        console.log(`✅ Synced teamA.teamAKitColor = ${updatedMatch.teamAkitcolor}`);
      }
      if (updatedMatch.teamBkitcolor !== undefined) {
        room.currentState.matchData.teamB.teamBKitColor = updatedMatch.teamBkitcolor;
        console.log(`✅ Synced teamB.teamBKitColor = ${updatedMatch.teamBkitcolor}`);
      }
      if (updatedMatch.teamA2kitcolor !== undefined) {
        room.currentState.matchData.teamA.teamA2KitColor = updatedMatch.teamA2kitcolor;
        console.log(`✅ Synced teamA.teamA2KitColor = ${updatedMatch.teamA2kitcolor}`);
      }
      if (updatedMatch.teamB2kitcolor !== undefined) {
        room.currentState.matchData.teamB.teamB2KitColor = updatedMatch.teamB2kitcolor;
        console.log(`✅ Synced teamB.teamB2KitColor = ${updatedMatch.teamB2kitcolor}`);
      }
  
      console.log("🔍 SAU SYNC - room.currentState.matchData.teamA:", room.currentState.matchData.teamA);
      console.log("🔍 SAU SYNC - room.currentState.matchData.teamB:", room.currentState.matchData.teamB);
  
      room.lastActivity = timestamp;
  
      // Tạo response object
      const responseMatchInfo = {};
      
      // Các field thông thường
      regularFields.forEach(field => {
        if (room.currentState.matchData[field] !== undefined) {
          responseMatchInfo[field] = room.currentState.matchData[field];
        }
      });
      
      // Lấy kit colors từ room state (đã được sync từ database)
      if (room.currentState.matchData.teamA?.teamAKitColor !== undefined) {
        responseMatchInfo.teamAkitcolor = room.currentState.matchData.teamA.teamAKitColor;
      }
      if (room.currentState.matchData.teamB?.teamBKitColor !== undefined) {
        responseMatchInfo.teamBkitcolor = room.currentState.matchData.teamB.teamBKitColor;
      }
      if (room.currentState.matchData.teamA?.teamA2KitColor !== undefined) {
        responseMatchInfo.teamA2kitcolor = room.currentState.matchData.teamA.teamA2KitColor;
      }
      if (room.currentState.matchData.teamB?.teamB2KitColor !== undefined) {
        responseMatchInfo.teamB2kitcolor = room.currentState.matchData.teamB.teamB2KitColor;
      }
      
      // Gửi thông tin match
      responseMatchInfo.matchId = updatedMatch.id;
      responseMatchInfo.updatedAt = updatedMatch.updatedAt;
  
      io.to(`room_${accessCode}`).emit('match_info_updated', {
        matchInfo: responseMatchInfo,
        timestamp: timestamp
      });
      
      console.log("Giá trị trả về match_info_updated là:", responseMatchInfo);
      logger.info(`Match info updated for room ${accessCode}`);
  
    } catch (error) {
      logger.error('Error in match_info_update:', error);
      socket.emit('match_info_error', {
        error: error.message,
        details: 'Failed to update match info'
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

  // Xử lý cập nhật round
  socket.on('round_update', async (data) => {
    console.log('📨 Received round_update:', data);

    try {
      const { accessCode, round, showRound, timestamp = Date.now() } = data;
      if (!accessCode) {
        throw new Error('Access code is required');
      }

      const behavior = data.behavior || 'add';

      const room = rooms.get(accessCode);

      if (!room) {
        throw new Error('Room not found');
      }

      const userData = userSessions.get(socket.id);

      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update round');
      }

      if (!room.currentState.round_data) {
        room.currentState.round_data = {
          round: '',
          showRound: true
        };
      }

      if (round !== undefined) {
        room.currentState.round_data.round = round;
      }
      if (showRound !== undefined) {
        room.currentState.round_data.showRound = showRound;
      }

      room.lastActivity = timestamp;

      if (behavior === 'add') {
        try {
          const updateData = {};
          if (round !== undefined) updateData.round = round;
          if (showRound !== undefined) updateData.showround = showRound;
          
          await updateDisplaySettings(accessCode, 'round', updateData);
        } catch (error) {
          console.error('❌ Lỗi khi lưu round vào database:', error.message);
          throw error;
        }
      }

      io.to(`room_${accessCode}`).emit('round_updated', {
        round: room.currentState.round_data.round,
        showRound: room.currentState.round_data.showRound,
        behavior: behavior,
        timestamp: timestamp
      });

      console.log('✅ Đã cập nhật và gửi lại dữ liệu round');

    } catch (error) {
      console.error('❌ Lỗi trong round_update:', error.message);
      socket.emit('error', {
        event: 'round_update',
        message: error.message
      });
    }
  });

  socket.on('group_update', async (data) => {
    console.log('📨 Received group_update:', data);

    try {
      const { accessCode, group, showGroup, timestamp = Date.now() } = data;
      if (!accessCode) {
        throw new Error('Access code is required');
      }

      const behavior = data.behavior || 'add';

      const room = rooms.get(accessCode);

      if (!room) {
        throw new Error('Room not found');
      }

      const userData = userSessions.get(socket.id);

      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update group');
      }

      if (!room.currentState.group_data) {
        room.currentState.group_data = {
          group: '',
          showGroup: true
        };
      }

      if (group !== undefined) {
        room.currentState.group_data.group = group;
      }
      if (showGroup !== undefined) {
        room.currentState.group_data.showGroup = showGroup;
      }

      room.lastActivity = timestamp;

      if (behavior === 'add') {
        try {
          const updateData = {};
          if (group !== undefined) updateData.group = group;
          if (showGroup !== undefined) updateData.showgroup = showGroup;
          
          await updateDisplaySettings(accessCode, 'group', updateData);
        } catch (error) {
          console.error('❌ Lỗi khi lưu group vào database:', error.message);
          throw error;
        }
      }

      io.to(`room_${accessCode}`).emit('group_updated', {
        group: room.currentState.group_data.group,
        showGroup: room.currentState.group_data.showGroup,
        behavior: behavior,
        timestamp: timestamp
      });

      console.log('✅ Đã cập nhật và gửi lại dữ liệu group');

    } catch (error) {
      console.error('❌ Lỗi trong group_update:', error.message);
      socket.emit('error', {
        event: 'group_update',
        message: error.message
      });
    }
  });

  socket.on('subtitle_update', async (data) => {
    console.log('📨 Received subtitle_update:', data);

    try {
      const { accessCode, subtitle, showSubtitle, timestamp = Date.now() } = data;
      if (!accessCode) {
        throw new Error('Access code is required');
      }

      const behavior = data.behavior || 'add';

      const room = rooms.get(accessCode);

      if (!room) {
        throw new Error('Room not found');
      }

      const userData = userSessions.get(socket.id);

      if (!userData || !room.adminClients.has(socket.id)) {
        throw new Error('Unauthorized: Only admin can update subtitle');
      }

      if (!room.currentState.subtitle_data) {
        room.currentState.subtitle_data = {
          subtitle: '',
          showSubtitle: false
        };
      }

      if (subtitle !== undefined) {
        room.currentState.subtitle_data.subtitle = subtitle;
      }
      if (showSubtitle !== undefined) {
        room.currentState.subtitle_data.showSubtitle = showSubtitle;
      }

      room.lastActivity = timestamp;

      if (behavior === 'add') {
        try {
          const updateData = {};
          if (subtitle !== undefined) updateData.subtitle = subtitle;
          if (showSubtitle !== undefined) updateData.showsubtitle = showSubtitle;
          
          await updateDisplaySettings(accessCode, 'subtitle', updateData);
        } catch (error) {
          console.error('❌ Lỗi khi lưu subtitle vào database:', error.message);
          throw error;
        }
      }

      io.to(`room_${accessCode}`).emit('subtitle_updated', {
        subtitle: room.currentState.subtitle_data.subtitle,
        showSubtitle: room.currentState.subtitle_data.showSubtitle,
        behavior: behavior,
        timestamp: timestamp
      });

      console.log('✅ Đã cập nhật và gửi lại dữ liệu subtitle');

    } catch (error) {
      console.error('❌ Lỗi trong subtitle_update:', error.message);
      socket.emit('error', {
        event: 'subtitle_update',
        message: error.message
      });
    }
  });
}

module.exports = { handleDisplaySettings };