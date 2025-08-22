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
    socket.on('live_unit_update', async (data) => {
        try {
            const { accessCode, liveUnit } = data;

            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('live_unit_update_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('live_unit_update_error', {
                    error: 'Bạn không có quyền cập nhật live unit',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            const result = await updateMatchInDatabase(accessCode, { live_unit: liveUnit.text });
            if (!result.success) {
                throw new Error(result.error || 'Không thể cập nhật live unit');
            }

            room.currentState.matchData.liveText = liveUnit.text || null;

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
    socket.on('commentator_update', async (data) => {
        try {
            const { accessCode, commentator } = data;

            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                logger.error(`Unauthorized access attempt for room: ${accessCode}`, { socketId: socket.id });
                return;
            }

            const result = await updateMatchInDatabase(accessCode, { commentator });
            if (!result.success) {
                throw new Error(result.error || 'Không thể cập nhật commentator');
            }

            room.currentState.matchData.commentator = commentator || null;

            io.to(`room_${accessCode}`).emit('commentator_updated', {
                commentator: room.currentState.matchData.commentator,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Commentator update error: ${error.message}`, {
                error: error.toString(),
                stack: error.stack,
                socketId: socket.id,
                data: data
            });
        }
    });


    socket.on('match_title_update', async (data) => {
        // console.log('Giá trị match_title_update là:', data);
        try {
            const { accessCode, matchTitle, timestamp = Date.now() } = data;

            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('match_update_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('match_update_error', {
                    error: 'Bạn không có quyền cập nhật thông tin trận đấu',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            const updateData = {};

            if (matchTitle !== undefined) {
                room.currentState.matchData.matchTitle = matchTitle;
                updateData.match_title = matchTitle;
            }

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

            if (!accessCode || !scores || typeof scores !== 'object') {
                throw new Error('Mã truy cập và tỉ số không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('score_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('score_error', {
                    error: 'Bạn không có quyền cập nhật tỉ số',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            console.log('Current matchData structure:', JSON.stringify(room.currentState.matchData, null, 2));

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

            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
            }

            console.log('Updated scores:', {
                teamA: room.currentState.matchData.teamA?.score,
                teamB: room.currentState.matchData.teamB?.score
            });
            room.lastActivity = timestamp;

            io.to(`room_${accessCode}`).emit('score_updated', {
                scores: {
                    home: room.currentState.matchData.teamA?.score || 0,
                    away: room.currentState.matchData.teamB?.score || 0
                },
                timestamp: timestamp
            });

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

    socket.on('futsal_errors_update', (data) => {
        try {
            console.log('DEBUG - futsal_errors_update data received:', JSON.stringify(data, null, 2));
            const { accessCode, futsalErrors, timestamp = Date.now() } = data;

            if (!accessCode || !futsalErrors) {
                throw new Error('Mã truy cập và lỗi không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                console.log(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                console.log(`Không quyền`);
            }

            const updateData = {};

            if (futsalErrors.teamA !== undefined) {
                room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
                room.currentState.matchData.teamA.teamAFutsalFoul = parseInt(futsalErrors.teamA) || 0;
                updateData.teamAFutsalFoul = room.currentState.matchData.teamA.teamAFutsalFoul;
            }
            if (futsalErrors.teamB !== undefined) {
                room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};
                room.currentState.matchData.teamB.teamBFutsalFoul = parseInt(futsalErrors.teamB) || 0;
                updateData.teamBFutsalFoul = room.currentState.matchData.teamB.teamBFutsalFoul;
            }

            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
            }

            console.log('Updated lỗi:', {
                teamA: room.currentState.matchData.teamA?.teamAFutsalFoul,
                teamB: room.currentState.matchData.teamB?.teamBFutsalFoul
            });
            room.lastActivity = timestamp;

            io.to(`room_${accessCode}`).emit('futsal_errors_updated', {
                futsalErrors: {
                    teamA: room.currentState.matchData.teamA?.teamAFutsalFoul || 0,
                    teamB: room.currentState.matchData.teamB?.teamBFutsalFoul || 0
                },
                timestamp: timestamp
            });

            if (Object.keys(updateData).length > 0 && room.matchId) {
                updateMatchInDatabase(room.matchId, updateData);
            }

        } catch (error) {
            logger.error('Error in score_update:', error);
            socket.emit('score_error', {
                error: 'Lỗi khi cập nhật tỷ số',
                details: error.message
            });
        }
    });

    socket.on('goal_scorers_update', async (data) => {
        try {
            console.log('DEBUG - goal_scorers_update data received:', JSON.stringify(data, null, 2));
            const { accessCode, scorer, team, timestamp = Date.now() } = data;

            if (!accessCode || !scorer || !team) {
                throw new Error('Mã truy cập, thông tin cầu thủ ghi bàn và đội không hợp lệ');
            }

            if (!scorer.player || scorer.minute === undefined) {
                throw new Error('Thiếu thông tin tên cầu thủ hoặc phút ghi bàn');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                console.log(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                socket.emit('goal_scorers_error', { error: 'Phòng không tồn tại' });
                return;
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                console.log(`Không có quyền cập nhật scorer`);
                socket.emit('goal_scorers_error', { error: 'Không có quyền thực hiện thao tác này' });
                return;
            }

            room.currentState.matchData = room.currentState.matchData || {};
            room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
            room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};

            if (!room.currentState.matchData.teamA.scorers) {
                room.currentState.matchData.teamA.scorers = [];
            }
            if (!room.currentState.matchData.teamB.scorers) {
                room.currentState.matchData.teamB.scorers = [];
            }

            let teamScorers, teamField;
            if (team === "teamA") {
                teamScorers = room.currentState.matchData.teamA.scorers;
                teamField = 'teamAScorers';
            } else if (team === "teamB") {
                teamScorers = room.currentState.matchData.teamB.scorers;
                teamField = 'teamBScorers';
            } else {
                throw new Error('Team phải là "teamA" hoặc "teamB"');
            }

            let existingPlayer = teamScorers.find(s => s.player === scorer.player);

            if (existingPlayer) {
                const scores = existingPlayer.score ? existingPlayer.score.split(',') : [];
                scores.push(scorer.minute.toString());
                existingPlayer.score = scores.join(',');
            } else {
                teamScorers.push({
                    player: scorer.player,
                    score: scorer.minute.toString()
                });
            }

            const updateData = {
                [teamField]: teamScorers
            };

            const dbResult = await updateMatchInDatabase(accessCode, updateData);
            if (!dbResult.success) {
                console.error('Failed to update database:', dbResult.error);
            }

            room.lastActivity = timestamp;

            io.to(`room_${accessCode}`).emit('goal_scorers_updated', {
                team: team,
                scorer: {
                    player: scorer.player,
                    minute: scorer.minute
                },
                timestamp: timestamp
            });

            console.log(`Goal scorer updated successfully for ${team}:`, {
                player: scorer.player,
                minute: scorer.minute,
                totalScorers: teamScorers.length
            });

        } catch (error) {
            logger.error('Error in goal_scorers_update:', error);
            socket.emit('goal_scorers_error', {
                error: 'Lỗi khi cập nhật thông tin ghi bàn',
                details: error.message
            });
        }
    });

    socket.on('team_names_update', (data) => {
        try {
            const { accessCode, names, timestamp = Date.now() } = data;

            if (!accessCode || !names || typeof names !== 'object') {
                throw new Error('Mã truy cập và tên đội không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('team_names_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('team_names_error', {
                    error: 'Bạn không có quyền cập nhật tên đội',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

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

            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
            }
            room.lastActivity = timestamp;

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

    socket.on('team_logos_update', (data) => {
        console.log("Giá trị Team logos update", data);
        try {
            const { accessCode, logos, timestamp = Date.now() } = data;

            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!logos || typeof logos !== 'object') {
                throw new Error('Dữ liệu logo không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('team_logos_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('team_logos_error', {
                    error: 'Bạn không có quyền cập nhật logo đội',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

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

            if (Object.keys(updateData).length > 0) {
                updateMatchInDatabase(accessCode, updateData);
                console.log("Giá trị của updateData", updateData);
            }

            room.lastActivity = timestamp;

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

    socket.on('match_stats_update', async (data) => {
        try {
            const { accessCode, stats, timestamp = Date.now() } = data;

            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!stats || typeof stats !== 'object') {
                throw new Error('Dữ liệu thống kê không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('stats_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('stats_error', {
                    error: 'Bạn không có quyền cập nhật thống kê',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            const statToDbField = {
                possession: {
                    team1: 'teamAPossession',
                    team2: 'teamBPossession'
                },
                totalShots: {
                    team1: 'teamAShots',
                    team2: 'teamBShots'
                },
                shotsOnTarget: {
                    team1: 'teamAShotsOnTarget',
                    team2: 'teamBShotsOnTarget'
                },
                corners: {
                    team1: 'teamACorners',
                    team2: 'teamBCorners'
                },
                fouls: {
                    team1: 'teamAFouls',
                    team2: 'teamBFouls'
                },
                yellowCards: {
                    team1: 'teamAYellowCards',
                    team2: 'teamBYellowCards'
                },
                redCards: {
                    team1: 'teamARedCards',
                    team2: 'teamBRedCards'
                }
            };

            const updateData = {};

            Object.entries(stats).forEach(([statKey, statValue]) => {
                if (statToDbField[statKey]) {
                    Object.entries(statValue).forEach(([teamKey, value]) => {
                        const dbField = statToDbField[statKey][teamKey];
                        if (dbField) {
                            if (statKey === 'possession') {
                                const currentValue = room.currentState.matchStats[statKey]?.[teamKey] || 0;
                                const addValue = parseInt(value) || 0;
                                const newValue = currentValue + addValue;

                                updateData[dbField] = newValue;

                                if (!room.currentState.matchStats[statKey]) {
                                    room.currentState.matchStats[statKey] = {};
                                }
                                room.currentState.matchStats[statKey][teamKey] = newValue;

                            } else if (statKey === 'yellowCards' || statKey === 'redCards') {
                                const arrayValue = Array.isArray(value) ? value : [];
                                updateData[dbField] = arrayValue;

                                if (room.currentState.matchStats[statKey]) {
                                    room.currentState.matchStats[statKey][teamKey] = arrayValue;
                                }
                            } else {
                                const intValue = parseInt(value) || 0;
                                updateData[dbField] = intValue;

                                if (room.currentState.matchStats[statKey]) {
                                    room.currentState.matchStats[statKey][teamKey] = intValue;
                                }
                            }
                        }
                    });
                }
            });

            if (Object.keys(updateData).length > 0) {
                try {
                    const result = await updateMatchInDatabase(accessCode, updateData);
                    if (!result.success) {
                        logger.error(`Failed to update match stats in database: ${result.error}`, {
                            accessCode,
                            updateData,
                            details: result.details
                        });
                    } else {
                        logger.info(`Match stats updated in database for access code: ${accessCode}`);
                    }
                } catch (dbError) {
                    logger.error('Database update error in match_stats_update:', dbError);
                }
            }

            room.lastActivity = timestamp;

            io.to(`room_${accessCode}`).emit('match_stats_updated', {
                stats: room.currentState.matchStats,
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

    // matchData.js - Phần xử lý update_card đã được sửa chữa

    socket.on('update_card', async (data) => {
        try {
            console.log('DEBUG - update_card data received:', JSON.stringify(data, null, 2));
            const { accessCode, team, cardType, player, minute, timestamp = Date.now() } = data;

            // Validate input
            if (!accessCode) {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!team || !cardType || !player || minute === undefined) {
                throw new Error('Thiếu thông tin thẻ phạt, cầu thủ hoặc phút');
            }

            // Get room and validate
            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('update_card_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            // Verify admin permission
            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('update_card_error', {
                    error: 'Bạn không có quyền cập nhật thẻ phạt',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Initialize match data structure if not exist
            room.currentState.matchData = room.currentState.matchData || {};
            room.currentState.matchData.teamA = room.currentState.matchData.teamA || {};
            room.currentState.matchData.teamB = room.currentState.matchData.teamB || {};

            // Initialize match stats card arrays if not exist - với kiểm tra an toàn hơn
            room.currentState.matchStats = room.currentState.matchStats || {};

            // Khởi tạo yellowCards nếu chưa có hoặc không phải object
            if (!room.currentState.matchStats.yellowCards || typeof room.currentState.matchStats.yellowCards !== 'object' || typeof room.currentState.matchStats.yellowCards.team1 === 'number') {
                room.currentState.matchStats.yellowCards = {
                    team1: [],
                    team2: []
                };
            } else {
                if (!Array.isArray(room.currentState.matchStats.yellowCards.team1)) {
                    room.currentState.matchStats.yellowCards.team1 = [];
                }
                if (!Array.isArray(room.currentState.matchStats.yellowCards.team2)) {
                    room.currentState.matchStats.yellowCards.team2 = [];
                }
            }

            // Khởi tạo redCards nếu chưa có hoặc không phải object
            if (!room.currentState.matchStats.redCards || typeof room.currentState.matchStats.redCards !== 'object' || typeof room.currentState.matchStats.redCards.team1 === 'number') {
                room.currentState.matchStats.redCards = {
                    team1: [],
                    team2: []
                };
            } else {
                if (!Array.isArray(room.currentState.matchStats.redCards.team1)) {
                    room.currentState.matchStats.redCards.team1 = [];
                }
                if (!Array.isArray(room.currentState.matchStats.redCards.team2)) {
                    room.currentState.matchStats.redCards.team2 = [];
                }
            }

            // Create new card data object
            const cardData = {
                playerId: player.id || null,
                playerName: player.name || 'Unknown Player',
                minute: parseInt(minute) || 0,
                timestamp: timestamp
            };

            // Debug: Log current matchStats structure
            console.log('Current matchStats structure:', JSON.stringify(room.currentState.matchStats, null, 2));
            console.log('Team:', team, 'CardType:', cardType);

            // Determine target arrays for matchStats only
            let statsCards, dbField;

            if (team === "teamA") {
                if (cardType === "yellow") {
                    console.log('Accessing yellowCards.team1:', room.currentState.matchStats.yellowCards?.team1);
                    statsCards = room.currentState.matchStats.yellowCards.team1;
                    dbField = 'teamAYellowCards';
                } else if (cardType === "red") {
                    console.log('Accessing redCards.team1:', room.currentState.matchStats.redCards?.team1);
                    statsCards = room.currentState.matchStats.redCards.team1;
                    dbField = 'teamARedCards';
                }
            } else if (team === "teamB") {
                if (cardType === "yellow") {
                    console.log('Accessing yellowCards.team2:', room.currentState.matchStats.yellowCards?.team2);
                    statsCards = room.currentState.matchStats.yellowCards.team2;
                    dbField = 'teamBYellowCards';
                } else if (cardType === "red") {
                    console.log('Accessing redCards.team2:', room.currentState.matchStats.redCards?.team2);
                    statsCards = room.currentState.matchStats.redCards.team2;
                    dbField = 'teamBRedCards';
                }
            }

            console.log('statsCards:', statsCards, 'dbField:', dbField);

            if (!statsCards || !dbField) {
                console.log('Error details:', {
                    statsCardsUndefined: !statsCards,
                    dbFieldUndefined: !dbField,
                    team: team,
                    cardType: cardType,
                    matchStatsStructure: Object.keys(room.currentState.matchStats)
                });
                throw new Error('Team hoặc cardType không hợp lệ');
            }

            // Check for duplicate cards
            const isDuplicateStats = statsCards.some(card =>
                card.playerId === cardData.playerId &&
                card.minute === cardData.minute &&
                Math.abs(card.timestamp - cardData.timestamp) < 1000 // Within 1 second
            );

            if (isDuplicateStats) {
                logger.warn(`Duplicate card detected for ${team} ${cardType}:`, cardData);
                return socket.emit('update_card_error', {
                    error: 'Thẻ phạt đã được thêm trước đó',
                    code: 'DUPLICATE_CARD',
                    timestamp: Date.now()
                });
            }

            // Add new card to stats array
            statsCards.push(cardData);

            // Sort cards by minute for better organization
            statsCards.sort((a, b) => a.minute - b.minute);

            console.log(`Added ${cardType} card for ${team}. Total stats cards:`, statsCards.length);

            // Prepare database update - sử dụng statsCards để lưu vào database
            const updateData = {
                [dbField]: statsCards
            };

            // Update database
            const dbResult = await updateMatchInDatabase(accessCode, updateData);
            if (!dbResult.success) {
                logger.error('Failed to update database:', dbResult.error);
                // Rollback the changes
                statsCards.pop();
                throw new Error('Không thể cập nhật cơ sở dữ liệu');
            }

            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('card_updated', {
                team: team,
                cardType: cardType,
                player: {
                    id: cardData.playerId,
                    name: cardData.playerName
                },
                minute: cardData.minute,
                totalCards: statsCards.length,
                allStatsCards: statsCards,          // Cards từ stats
                timestamp: timestamp
            });

            logger.info(`${cardType} card added for ${team}:`, {
                player: cardData.playerName,
                minute: cardData.minute,
                totalStatsCards: statsCards.length
            });

        } catch (error) {
            logger.error('Error in update_card:', error);
            socket.emit('update_card_error', {
                error: 'Lỗi khi cập nhật thẻ phạt',
                details: error.message,
                timestamp: Date.now()
            });
        }
    });

    socket.on('match_stats_update', async (data) => {
        try {
            const { accessCode, stats, timestamp = Date.now() } = data;

            if (!accessCode || typeof accessCode !== 'string' || accessCode.trim() === '') {
                throw new Error('Mã truy cập không hợp lệ');
            }

            if (!stats || typeof stats !== 'object') {
                throw new Error('Dữ liệu thống kê không hợp lệ');
            }

            const room = rooms.get(accessCode);
            if (!room) {
                logger.error(`Room not found for access code: ${accessCode}`, { socketId: socket.id });
                return socket.emit('stats_error', {
                    error: 'Không tìm thấy phòng. Vui lòng thử lại sau khi tham gia phòng.',
                    code: 'ROOM_NOT_FOUND',
                    timestamp: Date.now()
                });
            }

            const userData = userSessions.get(socket.id);
            if (!userData || !room.adminClients.has(socket.id)) {
                return socket.emit('stats_error', {
                    error: 'Bạn không có quyền cập nhật thống kê',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            const statToDbField = {
                possession: {
                    team1: 'teamAPossession',
                    team2: 'teamBPossession'
                },
                totalShots: {
                    team1: 'teamAShots',
                    team2: 'teamBShots'
                },
                shotsOnTarget: {
                    team1: 'teamAShotsOnTarget',
                    team2: 'teamBShotsOnTarget'
                },
                corners: {
                    team1: 'teamACorners',
                    team2: 'teamBCorners'
                },
                fouls: {
                    team1: 'teamAFouls',
                    team2: 'teamBFouls'
                },
                // Thêm xử lý cho yellowCards và redCards như mảng
                yellowCards: {
                    team1: 'teamAYellowCards',
                    team2: 'teamBYellowCards'
                },
                redCards: {
                    team1: 'teamARedCards',
                    team2: 'teamBRedCards'
                }
            };

            const updateData = {};

            Object.entries(stats).forEach(([statKey, statValue]) => {
                if (statToDbField[statKey]) {
                    Object.entries(statValue).forEach(([teamKey, value]) => {
                        const dbField = statToDbField[statKey][teamKey];
                        if (dbField) {
                            // Xử lý khác nhau cho số và mảng
                            if (statKey === 'yellowCards' || statKey === 'redCards') {
                                // Đối với thẻ phạt, giá trị là mảng
                                const arrayValue = Array.isArray(value) ? value : [];
                                updateData[dbField] = arrayValue;

                                if (room.currentState.matchStats[statKey]) {
                                    room.currentState.matchStats[statKey][teamKey] = arrayValue;
                                }
                            } else {
                                // Đối với các thống kê khác, giá trị là số
                                const intValue = parseInt(value) || 0;
                                updateData[dbField] = intValue;

                                if (room.currentState.matchStats[statKey]) {
                                    room.currentState.matchStats[statKey][teamKey] = intValue;
                                }
                            }
                        }
                    });
                }
            });

            if (Object.keys(updateData).length > 0) {
                try {
                    const result = await updateMatchInDatabase(accessCode, updateData);
                    if (!result.success) {
                        logger.error(`Failed to update match stats in database: ${result.error}`, {
                            accessCode,
                            updateData,
                            details: result.details
                        });
                    } else {
                        logger.info(`Match stats updated in database for access code: ${accessCode}`);
                    }
                } catch (dbError) {
                    logger.error('Database update error in match_stats_update:', dbError);
                }
            }

            room.lastActivity = timestamp;

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

            Object.keys(marqueeData).forEach(key => {
                if (room.currentState.marqueeData[key] !== undefined) {
                    room.currentState.marqueeData[key] = marqueeData[key];
                }
            });
            room.lastActivity = timestamp;

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

    // Handle team score set update
    socket.on('team_score_set_update', async (data) => {
        try {
            const { accessCode, teamAScoreSet, teamBScoreSet } = data;

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
                    error: 'Bạn không có quyền cập nhật tỷ số set',
                    code: 'UNAUTHORIZED',
                    timestamp: Date.now()
                });
            }

            // Update room state
            if (typeof teamAScoreSet === 'number') {
                room.currentState.matchData.teamA.scoreSet = teamAScoreSet;
            }
            if (typeof teamBScoreSet === 'number') {
                room.currentState.matchData.teamB.scoreSet = teamBScoreSet;
            }

            // Update in database
            const updateData = {};
            if (typeof teamAScoreSet === 'number') {
                updateData.teamAScoreSet = teamAScoreSet;
            }
            if (typeof teamBScoreSet === 'number') {
                updateData.teamBScoreSet = teamBScoreSet;
            }

            if (Object.keys(updateData).length > 0) {
                const result = await updateMatchInDatabase(accessCode, updateData);
                if (!result.success) {
                    throw new Error(result.error || 'Không thể cập nhật tỷ số set');
                }
            }

            // Broadcast to all clients in the room
            io.to(`room_${accessCode}`).emit('team_score_set_updated', {
                teamAScoreSet: room.currentState.matchData.teamA.scoreSet,
                teamBScoreSet: room.currentState.matchData.teamB.scoreSet,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Team score set update error: ${error.message}`, {
                error: error.toString(),
                stack: error.stack,
                socketId: socket.id,
                data: data
            });

            socket.emit('match_update_error', {
                error: error.message || 'Đã xảy ra lỗi khi cập nhật tỷ số set',
                code: error.code || 'UPDATE_ERROR',
                timestamp: Date.now()
            });
        }
    });
};

module.exports = { handleMatchData };
