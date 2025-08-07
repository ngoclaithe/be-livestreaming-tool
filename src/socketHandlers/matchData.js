const logger = require('../utils/logger');
const { Match } = require('../models');

const { AccessCode } = require('../models');

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

async function updateMatchInDatabase(accessCode, updateData) {
    try {
        const cleanedUpdateData = { ...updateData };

        if (cleanedUpdateData.teamALogo) {
            cleanedUpdateData.teamALogo = cleanLogoUrl(cleanedUpdateData.teamALogo);
            logger.info(`Cleaned teamALogo: ${updateData.teamALogo} -> ${cleanedUpdateData.teamALogo}`);
        }

        if (cleanedUpdateData.teamBLogo) {
            cleanedUpdateData.teamBLogo = cleanLogoUrl(cleanedUpdateData.teamBLogo);
            logger.info(`Cleaned teamBLogo: ${updateData.teamBLogo} -> ${cleanedUpdateData.teamBLogo}`);
        }

        const accessCodeRecord = await AccessCode.findOne({
            where: { code: accessCode },
            attributes: ['matchId'],
            include: [{
                model: Match,
                as: 'match',
                required: false
            }]
        });

        if (!accessCodeRecord) {
            logger.error(`Access code not found: ${accessCode}`);
            return { success: false, error: 'Mã truy cập không hợp lệ' };
        }

        if (!accessCodeRecord.matchId) {
            logger.error(`No match associated with access code: ${accessCode}`);
            return { success: false, error: 'Mã truy cập chưa được liên kết với trận đấu nào' };
        }

        if (!accessCodeRecord.match) {
            logger.error(`Match not found with ID: ${accessCodeRecord.matchId} referenced by access code: ${accessCode}`);
            return {
                success: false,
                error: 'Thông tin trận đấu không tồn tại',
                details: `Match ID ${accessCodeRecord.matchId} not found`
            };
        }

        const [updated] = await Match.update(cleanedUpdateData, {
            where: { id: accessCodeRecord.matchId }
        });

        if (updated === 0) {
            logger.error(`Failed to update match with ID: ${accessCodeRecord.matchId}`);
            return {
                success: false,
                error: 'Không thể cập nhật thông tin trận đấu',
                details: 'No rows were updated'
            };
        }

        logger.info(`Match ${accessCodeRecord.matchId} updated in database via access code ${accessCode}`);
        return { success: true };
    } catch (error) {
        logger.error(`Error updating match in database: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            accessCode,
            updateData
        });
        return {
            success: false,
            error: 'Lỗi khi cập nhật cơ sở dữ liệu',
            details: error.message
        };
    }
}

function handleMatchData(io, socket, rooms, userSessions) {
    // Xử lý cập nhật live unit
    socket.on('live_unit_update', async (data) => {
        try {
            const { accessCode, liveUnit } = data;

            // Validate input
            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('live_unit_update_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('live_unit_update_error', {
                    error: 'Bạn không có quyền cập nhật live unit',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Update in database
            const result = await updateMatchInDatabase(accessCode, { live_unit: liveUnit.text });
            if (!result.success) {
                throw new Error(result.error || 'Không thể cập nhật live unit');
            }

            // Update room state
            room.currentState.matchData.liveText = liveUnit.text || null;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('live_unit_updated', {
                liveText: room.currentState.matchData.liveText,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Live unit update error: ${error.message}`, {
                error: error.toString(),
                stack: error.stack,
                socketId: socket.id,
                data: data
            });

            socket.emit('live_unit_update_error', {
                error: error.message || 'Đã xảy ra lỗi khi cập nhật live unit',
                code: error.code || 'UPDATE_ERROR',
                timestamp: Date.now()
            });
        }
    });

    socket.on('match_title_update', async (data) => {
        console.log('Giá trị match_title_update là:', data);
        try {
            const { accessCode, matchTitle, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('match_update_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('match_update_error', {
                    error: 'Bạn không có quyền cập nhật thông tin trận đấu',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Prepare update data
            const updateData = {};

            // Process title if provided
            if (matchTitle !== undefined) {
                room.currentState.matchData.matchTitle = matchTitle;
                updateData.match_title = matchTitle;
            }

            // Update in database if there are changes
            if (Object.keys(updateData).length > 0) {
                const result = await updateMatchInDatabase(accessCode, updateData);
                if (!result.success) {
                    throw new Error(result.error || 'Không thể cập nhật thông tin trận đấu');
                }

                io.to(`room_${accessCode}`).emit('match_title_updated', {
                    matchTitle: room.currentState.matchData.matchTitle,
                    timestamp: timestamp
                });

                logger.info(`Match title updated for room ${accessCode}`, {
                    matchTitle: matchTitle
                });
            }

        } catch (error) {
            logger.error(`Error in match_title_update: ${error.message}`, { error });
            socket.emit('match_update_error', {
                error: error.message || 'Đã xảy ra lỗi khi cập nhật thông tin trận đấu',
                code: 'UPDATE_ERROR',
                timestamp: Date.now()
            });
        }
    });

    // Score updates
    socket.on('score_update', (data) => {
        try {
            console.log('DEBUG - score_update data received:', JSON.stringify(data, null, 2));
            const { accessCode, scores, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode || !scores || typeof scores !== 'object') {
                throw new Error('Mã truy cập và tỉ số không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('score_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('score_error', {
                    error: 'Bạn không có quyền cập nhật tỉ số',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Log để kiểm tra cấu trúc dữ liệu hiện tại
            console.log('Current matchData structure:', JSON.stringify(room.currentState.matchData, null, 2));

            // Update scores with new teamA/teamB structure
            const updateData = {};

            if (scores.teamA !== undefined) {
                room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
                room.currentState.matchData.teamA.score = parseInt(scores.teamA) || 0;
                updateData.homeScore = room.currentState.matchData.teamA.score;
            }
            if (scores.teamB !== undefined) {
                room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};
                room.currentState.matchData.teamB.score = parseInt(scores.teamB) || 0;
                updateData.awayScore = room.currentState.matchData.teamB.score;
            }

            // Update scores and team info in database
            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
            }

            // Log để kiểm tra sau khi cập nhật
            console.log('Updated scores:', {
                teamA: room.currentState.matchData.teamA?.score,
                teamB: room.currentState.matchData.teamB?.score
            });
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('score_updated', {
                scores: {
                    home: room.currentState.matchData.teamA?.score || 0,
                    away: room.currentState.matchData.teamB?.score || 0
                },
                timestamp: timestamp
            });

            // Update scores in database if matchId exists
            if (Object.keys(updateData).length > 0 && room.matchId) {
                updateMatchInDatabase(room.matchId, updateData);
            }

            logger.info(`Scores updated for room ${accessCode}: ${scores.teamA}-${scores.teamB}`);

        } catch (error) {
            logger.error('Error in score_update:', error);
            socket.emit('score_error', {
                error: 'Lỗi khi cập nhật tỷ số',
                details: error.message
            });
        }
    });

    // Team names update
    socket.on('team_names_update', (data) => {
        try {
            const { accessCode, names, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode || !names || typeof names !== 'object') {
                throw new Error('Mã truy cập và tên đội không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('team_names_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('team_names_error', {
                    error: 'Bạn không có quyền cập nhật tên đội',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Update team names with new structure and prepare for database update
            const updateData = {};

            if (names.teamA) {
                room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
                room.currentState.matchData.teamA.name = String(names.teamA);
                updateData.teamAName = String(names.teamA);
            }
            if (names.teamB) {
                room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};
                room.currentState.matchData.teamB.name = String(names.teamB);
                updateData.teamBName = String(names.teamB);
            }

            // Update team names in database
            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
            }
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('team_names_updated', {
                names: {
                    home: room.currentState.matchData.teamA.name,
                    away: room.currentState.matchData.teamB.name
                },
                timestamp: timestamp
            });

            logger.info(`Team names updated for room ${accessCode}: ${names.home} vs ${names.away}`);

        } catch (error) {
            logger.error('Error in team_names_update:', error);
            socket.emit('team_names_error', {
                error: 'Lỗi khi cập nhật tên đội',
                details: error.message
            });
        }
    });

    // Team logos update
    socket.on('team_logos_update', (data) => {
        console.log("Giá trị Team logos update", data);
        try {
            const { accessCode, logos, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!logos || typeof logos !== 'object') {
                throw new Error('Dữ liệu logo không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('team_logos_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('team_logos_error', {
                    error: 'Bạn không có quyền cập nhật logo đội',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Update team logos with new teamA/teamB structure and prepare for database update
            const updateData = {};

            if (logos.teamA) {
                room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
                room.currentState.matchData.teamA.logo = String(logos.teamA);
                updateData.teamALogo = String(logos.teamA);
            }
            if (logos.teamB) {
                room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};
                room.currentState.matchData.teamB.logo = String(logos.teamB);
                updateData.teamBLogo = String(logos.teamB);
            }

            // Update team logos in database
            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
                console.log("Giá trị của updateData", updateData);
            }

            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('team_logos_updated', {
                logos: {
                    home: room.currentState.matchData.teamA.logo,
                    away: room.currentState.matchData.teamB.logo
                },
                timestamp: timestamp
            });

            logger.info(`Team logos updated for room ${accessCode}`);

        } catch (error) {
            logger.error('Error in team_logos_update:', error);
            socket.emit('team_logos_error', {
                error: 'Lỗi khi cập nhật logo đội',
                details: error.message
            });
        }
    });

    // Match time update
    socket.on('match_time_update', (data) => {
        try {
            console.log('[match_time_update] Received data:', JSON.stringify(data, null, 2));
            const { accessCode, time, timestamp = Date.now() } = data;

            if (!accessCode || !time) {
                throw new Error('Access code and time data are required');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                throw new Error('Room not found');
            }

            // Log current matchData status
            console.log(`[match_time_update] Current matchData.status for room ${accessCode}:`, room.currentState.matchData.status);

            // Update room state
            if (time.matchTime !== undefined) {
                console.log(`[match_time_update] Updating matchTime from ${room.currentState.matchData.matchTime} to ${time.matchTime}`);
                room.currentState.matchData.matchTime = time.matchTime;
            }
            if (time.period !== undefined) {
                room.currentState.matchData.period = time.period;
            }
            if (time.status !== undefined) {
                room.currentState.matchData.status = time.status;
            }
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('match_time_updated', {
                time: {
                    matchTime: room.currentState.matchData.matchTime,
                    period: room.currentState.matchData.period,
                    status: room.currentState.matchData.status
                },
                timestamp: timestamp
            });

            logger.info(`Match time updated for room ${accessCode}: ${time.matchTime} (${time.period})`);

        } catch (error) {
            logger.error('Error in match_time_update:', error);
            socket.emit('match_time_error', {
                error: 'Lỗi khi cập nhật thời gian trận đấu',
                details: error.message
            });
        }
    });

    // Match stats update
    socket.on('match_stats_update', (data) => {
        try {
            const { accessCode, stats, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!stats || typeof stats !== 'object') {
                throw new Error('Dữ liệu thống kê không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('stats_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('stats_error', {
                    error: 'Bạn không có quyền cập nhật thống kê',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Map teamA/teamB to team1/team2 for internal storage
            const statMappings = {
                possession: { teamA: 'team1', teamB: 'team2' },
                totalShots: { teamA: 'team1', teamB: 'team2' },
                shotsOnTarget: { teamA: 'team1', teamB: 'team2' },
                corners: { teamA: 'team1', teamB: 'team2' },
                yellowCards: { teamA: 'team1', teamB: 'team2' },
                fouls: { teamA: 'team1', teamB: 'team2' }
            };

            // Update stats with new teamA/teamB structure
            Object.entries(stats).forEach(([statKey, statValue]) => {
                if (room.currentState.matchStats[statKey]) {
                    Object.entries(statValue).forEach(([teamKey, value]) => {
                        const internalTeamKey = statMappings[statKey]?.[teamKey];
                        if (internalTeamKey && room.currentState.matchStats[statKey][internalTeamKey] !== undefined) {
                            room.currentState.matchStats[statKey][internalTeamKey] = parseInt(value) || 0;
                        }
                    });
                }
            });

            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('match_stats_updated', {
                stats: stats,
                timestamp: timestamp
            });

            logger.info(`Match stats updated for room ${accessCode}`);

        } catch (error) {
            logger.error('Error in match_stats_update:', error);
            socket.emit('match_stats_error', {
                error: 'Lỗi khi cập nhật thống kê trận đấu',
                details: error.message
            });
        }
    });

    // Penalty updates
    socket.on('penalty_update', (data) => {
        console.log("Giá trị penalty_update là:", data);
        try {
            const { accessCode, penaltyData, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!penaltyData || typeof penaltyData !== 'object') {
                throw new Error('Dữ liệu penalty không hợp lệ');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('penalty_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('penalty_error', {
                    error: 'Bạn không có quyền cập nhật đá luân lưu',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Update penalty data with new teamA/teamB structure
            if (penaltyData.teamAGoals !== undefined) {
                room.currentState.penaltyData.homeGoals = parseInt(penaltyData.teamAGoals) || 0;
            }
            if (penaltyData.teamBGoals !== undefined) {
                room.currentState.penaltyData.awayGoals = parseInt(penaltyData.teamBGoals) || 0;
            }
            if (penaltyData.currentTurn) {
                room.currentState.penaltyData.currentTurn =
                    penaltyData.currentTurn === 'teamA' ? 'home' : 'away';
            }
            if (Array.isArray(penaltyData.shootHistory)) {
                room.currentState.penaltyData.shootHistory = penaltyData.shootHistory;
            }
            if (penaltyData.status) {
                room.currentState.penaltyData.status = penaltyData.status;
            }
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('penalty_updated', {
                penaltyData: room.currentState.penaltyData,
                timestamp: timestamp
            });

            logger.info(`Penalty data updated for room ${accessCode}`, penaltyData);

        } catch (error) {
            logger.error('Error in penalty_update:', error);
            socket.emit('penalty_error', {
                error: 'Lỗi khi cập nhật đá luân lưu',
                details: error.message
            });
        }
    });

    // Marquee updates
    socket.on('marquee_update', (data) => {
        try {
            const { accessCode, marqueeData, timestamp = Date.now() } = data;

            if (!accessCode || !marqueeData) {
                throw new Error('Access code and marquee data are required');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                throw new Error('Room not found');
            }

            // Update room state - only update provided marquee data
            Object.keys(marqueeData).forEach(key => {
                if (room.currentState.marqueeData[key] !== undefined) {
                    room.currentState.marqueeData[key] = marqueeData[key];
                }
            });
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('marquee_updated', {
                marqueeData: room.currentState.marqueeData,
                timestamp: timestamp
            });

            logger.info(`Marquee data updated for room ${accessCode}`);

        } catch (error) {
            logger.error('Error in marquee_update:', error);
            socket.emit('marquee_error', {
                error: 'Lỗi khi cập nhật chữ chạy',
                details: error.message
            });
        }
    });

    // Lineup updates
    socket.on('lineup_update', (data) => {
        try {
            const { accessCode, lineup, timestamp = Date.now() } = data;

            if (!accessCode || !lineup) {
                throw new Error('Access code and lineup data are required');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                throw new Error('Room not found');
            }

            // Initialize lineupData if it doesn't exist
            if (!room.currentState.lineupData) {
                room.currentState.lineupData = {};
            }

            // Update team lineups
            if (lineup.teamA && Array.isArray(lineup.teamA)) {
                room.currentState.lineupData.teamA = lineup.teamA.map(player => ({
                    number: player.number || '',
                    name: player.name || ''
                }));
            }

            if (lineup.teamB && Array.isArray(lineup.teamB)) {
                room.currentState.lineupData.teamB = lineup.teamB.map(player => ({
                    number: player.number || '',
                    name: player.name || ''
                }));
            }

            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            console.log("giá trị broadcast là:", room.currentState.lineupData);
            io.to(`room_${accessCode}`).emit('lineup_updated', {
                lineupData: room.currentState.lineupData,
                timestamp: timestamp
            });

            logger.info(`Lineup data updated for room ${accessCode}`);

        } catch (error) {
            logger.error('Error in lineup_update:', error);
            socket.emit('lineup_error', {
                error: 'Lỗi khi cập nhật đội hình',
                details: error.message
            });
        }
    });
}

module.exports = { handleMatchData };
