const logger = require('../utils/logger');

/**
 * Handles all match-related socket events
 */
function handleMatchData(io, socket, rooms, userSessions) {

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
            if (scores.teamA !== undefined) {
                room.currentState.matchData.homeTeam = room.currentState.matchData.homeTeam || {};
                room.currentState.matchData.homeTeam.score = parseInt(scores.teamA) || 0;
            }
            if (scores.teamB !== undefined) {
                room.currentState.matchData.awayTeam = room.currentState.matchData.awayTeam || {};
                room.currentState.matchData.awayTeam.score = parseInt(scores.teamB) || 0;
            }
            
            // Log để kiểm tra sau khi cập nhật
            console.log('Updated scores:', {
                teamA: room.currentState.matchData.homeTeam?.score,
                teamB: room.currentState.matchData.awayTeam?.score
            });
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('score_updated', {
                scores: {
                    home: room.currentState.matchData.homeTeam.score,
                    away: room.currentState.matchData.awayTeam.score
                },
                timestamp: timestamp
            });

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

            // Update team names with new structure
            if (names.teamA) {
                room.currentState.matchData.homeTeam.name = String(names.teamA);
            }
            if (names.teamB) {
                room.currentState.matchData.awayTeam.name = String(names.teamB);
            }
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('team_names_updated', {
                names: {
                    home: room.currentState.matchData.homeTeam.name,
                    away: room.currentState.matchData.awayTeam.name
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

            // Update team logos with new teamA/teamB structure
            if (logos.teamA) {
                room.currentState.matchData.homeTeam.logo = String(logos.teamA);
            }
            if (logos.teamB) {
                room.currentState.matchData.awayTeam.logo = String(logos.teamB);
            }
            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('team_logos_updated', {
                logos: {
                    home: room.currentState.matchData.homeTeam.logo,
                    away: room.currentState.matchData.awayTeam.logo
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

            logger.info(`Penalty data updated for room ${accessCode}`);

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
}

module.exports = { handleMatchData };
