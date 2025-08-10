const logger = require('../utils/logger');
const { Match, PlayerList, AccessCode } = require('../models');

async function updatePlayerListInDatabase(accessCode, teamType, players) {
    try {
        // Tìm hoặc tạo mới player list
        const [playerList, created] = await PlayerList.findOrCreate({
            where: { 
                accessCode,
                teamType
            },
            defaults: {
                players: players.map(p => ({
                    name: p.name || '',
                    number: p.number || ''
                }))
            }
        });

        // Nếu đã tồn tại thì cập nhật
        if (!created) {
            playerList.players = players.map(p => ({
                name: p.name || '',
                number: p.number || ''
            }));
            await playerList.save();
        }

        return { 
            success: true, 
            data: playerList 
        };

    } catch (error) {
        logger.error(`Error updating player list in database: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            accessCode,
            teamType
        });
        return {
            success: false,
            error: 'Lỗi khi cập nhật cơ sở dữ liệu',
            details: error.message
        };
    }
}

function handlePlayerList(io, socket, rooms, userSessions) {
    socket.on('lineup_update', async (data) => {
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

            // Cập nhật dữ liệu vào database
            if (lineup.teamA && Array.isArray(lineup.teamA)) {
                room.currentState.lineupData.teamA = lineup.teamA.map(player => ({
                    number: player.number || '',
                    name: player.name || ''
                }));
                
                // Lưu vào database
                await updatePlayerListInDatabase(
                    accessCode, 
                    'teamA', 
                    lineup.teamA
                );
            }

            if (lineup.teamB && Array.isArray(lineup.teamB)) {
                room.currentState.lineupData.teamB = lineup.teamB.map(player => ({
                    number: player.number || '',
                    name: player.name || ''
                }));

                // Lưu vào database
                await updatePlayerListInDatabase(
                    accessCode, 
                    'teamB', 
                    lineup.teamB
                );
            }

            room.lastActivity = timestamp;

            // Broadcast to all clients in the room
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

    // socket.on('get_lineup', async ({ accessCode }) => {
    //     try {
    //         if (!accessCode) {
    //             throw new Error('Access code is required');
    //         }

    //         // Lấy dữ liệu từ database
    //         const teamAList = await PlayerList.findOne({
    //             where: { accessCode, teamType: 'teamA' }
    //         });

    //         const teamBList = await PlayerList.findOne({
    //             where: { accessCode, teamType: 'teamB' }
    //         });

    //         const lineupData = {
    //             teamA: teamAList ? teamAList.players : [],
    //             teamB: teamBList ? teamBList.players : []
    //         };

    //         // Gửi dữ liệu về cho client yêu cầu
    //         socket.emit('lineup_data', { lineupData });

    //     } catch (error) {
    //         logger.error('Error getting lineup:', error);
    //         socket.emit('lineup_error', {
    //             error: 'Lỗi khi lấy dữ liệu đội hình',
    //             details: error.message
    //         });
    //     }
    // });
}

module.exports = { handlePlayerList };