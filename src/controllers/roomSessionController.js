const { RoomSession, AccessCode, DisplaySetting } = require('../models');
const logger = require('../utils/logger');

/**
 * Lấy tất cả các room sessions
 * @route GET /api/room-sessions
 * @access Public
 */
const getAllRoomSessions = async (req, res) => {
    try {
        const roomSessions = await RoomSession.findAll({
            include: [
                {
                    association: 'accessCodeInfo',
                    attributes: ['code', 'status', 'expiredAt']
                }
            ]
        });
        res.json(roomSessions);
    } catch (error) {
        console.error('Error fetching room sessions:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách room sessions' });
    }
};

/**
 * Lấy thông tin chi tiết một room session theo ID
 * @route GET /api/room-sessions/:id
 * @access Public
 */
const getRoomSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const roomSession = await RoomSession.findByPk(id, {
            include: [
                {
                    association: 'accessCodeInfo',
                    attributes: ['code', 'status', 'expiredAt']
                }
            ]
        });

        if (!roomSession) {
            return res.status(404).json({ message: 'Không tìm thấy room session' });
        }

        res.json(roomSession);
    } catch (error) {
        console.error('Error fetching room session:', error);
        res.status(500).json({ message: 'Lỗi khi lấy thông tin room session' });
    }
};

/**
 * Lấy room session theo access code
 * @route GET /api/room-sessions/access-code/:code
 * @access Public
 */
const getRoomSessionByAccessCode = async (req, res) => {
    try {
        const { code } = req.params;
        const roomSession = await RoomSession.findOne({
            where: { accessCode: code },
            include: [
                {
                    association: 'accessCodeInfo',
                    attributes: ['code', 'status', 'expiredAt']
                }
            ]
        });

        if (!roomSession) {
            return res.status(404).json({ message: 'Không tìm thấy room session với access code này' });
        }

        res.json(roomSession);
    } catch (error) {
        console.error('Error fetching room session by access code:', error);
        res.status(500).json({ message: 'Lỗi khi lấy thông tin room session' });
    }
};

/**
 * Lấy danh sách các room session đang hoạt động
 * @route GET /api/room-sessions/active
 * @access Public
 */
const getActiveRoomSessions = async (req, res) => {
    try {
        const activeSessions = await RoomSession.findAll({
            where: { status: 'active' },
            include: [
                {
                    association: 'accessCodeInfo',
                    attributes: ['code', 'status', 'expiredAt']
                }
            ]
        });
        res.json(activeSessions);
    } catch (error) {
        console.error('Error fetching active room sessions:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách room session đang hoạt động' });
    }
};

/**
 * Xóa một phòng theo ID (sử dụng logic giống handleRoomExpiration)
 * @route DELETE /api/room-sessions/:id
 * @access Private/Admin
 */
const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Lấy thông tin phòng trước khi xóa để lấy accessCode
        const roomSession = await RoomSession.findByPk(id);
        if (!roomSession) {
            return res.status(404).json({ message: 'Không tìm thấy phòng để xóa' });
        }
        
        const accessCode = roomSession.accessCode;
        const io = req.app.get('io');
        const rooms = req.app.get('rooms'); // Map object từ roomManagement
        let disconnectedClients = 0;
        
        logger.info(`Admin deleting room: ${accessCode}`);
        console.log(`Bắt đầu xóa phòng: ${accessCode} bởi admin`);
        
        try {
            // 2. Cập nhật trạng thái trong database (giống handleRoomExpiration)
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
            
            // 3. Xử lý Socket.IO - FORCE DISCONNECT TẤT CẢ
            if (io) {
                // Lấy tất cả socket trong phòng TRƯỚC KHI gửi thông báo
                const sockets = await io.in(`room_${accessCode}`).fetchSockets();
                console.log(`Tìm thấy ${sockets.length} kết nối trong phòng ${accessCode} sẽ bị ngắt`);
                
                // Gửi thông báo đến tất cả client trong phòng
                io.to(`room_${accessCode}`).emit('room_expired', {
                    message: 'Phòng đã bị xóa bởi quản trị viên',
                    accessCode: accessCode,
                    forced: true
                });
                console.log(`Đã gửi thông báo xóa đến các client trong phòng: ${accessCode}`);

                // Chờ một chút để thông báo được gửi
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // FORCE DISCONNECT tất cả socket
                for (const socket of sockets) {
                    try {
                        console.log(`FORCE DISCONNECT socket ID: ${socket.id} trong phòng ${accessCode}`);
                        
                        // Xóa khỏi tất cả rooms
                        socket.rooms.forEach(room => {
                            if (room.startsWith('room_')) {
                                socket.leave(room);
                            }
                        });
                        
                        // Xóa khỏi room cụ thể
                        socket.leave(`room_${accessCode}`);
                        
                        // Force disconnect với close = true
                        socket.disconnect(true);
                        
                        // Đảm bảo socket bị đóng hoàn toàn
                        if (socket.conn) {
                            socket.conn.close();
                        }
                        
                        disconnectedClients++;
                        console.log(`ĐÃ FORCE DISCONNECT socket ID: ${socket.id}`);
                    } catch (socketError) {
                        console.error(`Lỗi khi force disconnect socket ${socket.id}:`, socketError);
                    }
                }

                // Kiểm tra lại sau khi disconnect
                const remainingSockets = await io.in(`room_${accessCode}`).fetchSockets();
                console.log(`Còn lại ${remainingSockets.length} socket trong phòng ${accessCode} sau khi disconnect`);
                
                if (remainingSockets.length > 0) {
                    console.warn(`CẢNH BÁO: Vẫn còn ${remainingSockets.length} socket chưa bị disconnect`);
                    // Force disconnect lần 2
                    for (const socket of remainingSockets) {
                        try {
                            socket.conn.close();
                            socket.disconnect(true);
                        } catch (err) {
                            console.error(`Lỗi force disconnect lần 2:`, err);
                        }
                    }
                }
            }

            // 4. Cleanup bộ nhớ và xóa room HOÀN TOÀN
            if (rooms && rooms.has(accessCode)) {
                const room = rooms.get(accessCode);
                
                // Xóa tất cả client references
                room.clients.clear();
                room.adminClients.clear();
                room.displayClients.clear();
                
                // Xóa room khỏi Map
                rooms.delete(accessCode);
                console.log(`Đã xóa phòng ${accessCode} khỏi bộ nhớ và clear tất cả clients`);
            }

            // 5. Xóa timeout và clear tất cả timers
            const roomTimeouts = req.app.get('roomTimeouts');
            if (roomTimeouts) {
                if (roomTimeouts.has(accessCode)) {
                    clearTimeout(roomTimeouts.get(accessCode));
                    roomTimeouts.delete(accessCode);
                    console.log(`Đã xóa timeout cho phòng ${accessCode}`);
                }
                
                // Xóa tất cả timeout related đến room này
                for (const [key, timeoutId] of roomTimeouts.entries()) {
                    if (key.includes(accessCode)) {
                        clearTimeout(timeoutId);
                        roomTimeouts.delete(key);
                        console.log(`Đã xóa timeout phụ: ${key}`);
                    }
                }
            }

            // 6. Force cleanup tất cả namespace rooms
            if (io) {
                try {
                    // Xóa room khỏi tất cả namespaces
                    const adapters = io.sockets.adapter;
                    if (adapters && adapters.rooms) {
                        adapters.rooms.delete(`room_${accessCode}`);
                        console.log(`Đã xóa room ${accessCode} khỏi Socket.IO adapter`);
                    }
                } catch (adapterError) {
                    console.error(`Lỗi khi xóa room khỏi adapter:`, adapterError);
                }
            }

            logger.info(`Room ${accessCode} deleted by admin and cleaned up successfully`);
            console.log(`Hoàn thành xóa phòng ${accessCode} bởi admin`);

            res.json({ 
                success: true,
                message: 'Đã xóa phòng thành công',
                accessCode: accessCode,
                disconnectedClients: disconnectedClients
            });

        } catch (error) {
            logger.error(`Error deleting room ${accessCode}:`, error);
            console.error(`Lỗi khi xóa phòng ${accessCode}:`, error);
            throw error;
        }
        
    } catch (error) {
        logger.error('Error in deleteRoom:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi xóa phòng',
            error: error.message 
        });
    }
};

/**
 * Ngắt kết nối client theo ID (đồng bộ với logic disconnect trong roomManagement)
 * @route POST /api/room-sessions/disconnect-client
 * @body {string} clientId - ID của client cần ngắt kết nối
 * @access Private/Admin
 */
const disconnectClient = async (req, res) => {
    try {
        const { clientId } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ message: 'Thiếu thông tin clientId' });
        }

        const io = req.app.get('io');
        const rooms = req.app.get('rooms');
        
        if (!io) {
            return res.status(500).json({ message: 'Socket.IO không khả dụng' });
        }

        // Lấy tất cả socket kết nối
        const sockets = await io.fetchSockets();
        
        // Tìm socket có id trùng với clientId
        const targetSocket = sockets.find(socket => socket.id === clientId);
        
        if (!targetSocket) {
            return res.status(404).json({ message: 'Không tìm thấy client để ngắt kết nối' });
        }

        // Tìm phòng chứa client này để cập nhật database
        let targetRoom = null;
        let accessCode = null;

        for (const [roomAccessCode, room] of rooms.entries()) {
            if (room.adminClients.has(clientId) || 
                room.clients.has(clientId) || 
                room.displayClients.has(clientId)) {
                targetRoom = room;
                accessCode = roomAccessCode;
                break;
            }
        }

        // Ngắt kết nối client (sẽ trigger disconnect event trong roomManagement)
        targetSocket.disconnect(true);
        
        logger.info(`Admin disconnected client ${clientId} from room ${accessCode || 'unknown'}`);

        res.json({ 
            success: true,
            message: `Đã ngắt kết nối client ${clientId} thành công`,
            clientId: clientId,
            room: accessCode
        });

    } catch (error) {
        logger.error('Error disconnecting client:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi ngắt kết nối client',
            error: error.message 
        });
    }
};

/**
 * Debug: Kiểm tra trạng thái connections của một phòng
 * @route GET /api/room-sessions/debug/:accessCode
 * @access Private/Admin
 */
const debugRoomConnections = async (req, res) => {
    try {
        const { accessCode } = req.params;
        const io = req.app.get('io');
        const rooms = req.app.get('rooms');
        
        const debug = {
            accessCode,
            timestamp: new Date().toISOString(),
            roomInMemory: null,
            socketConnections: [],
            adapterRooms: null,
            databaseRoom: null
        };

        // 1. Kiểm tra room trong bộ nhớ
        if (rooms && rooms.has(accessCode)) {
            const room = rooms.get(accessCode);
            debug.roomInMemory = {
                clients: Array.from(room.clients),
                adminClients: Array.from(room.adminClients),
                displayClients: Array.from(room.displayClients),
                totalClients: room.clients.size + room.adminClients.size,
                totalDisplays: room.displayClients.size
            };
        }

        // 2. Kiểm tra Socket.IO connections
        if (io) {
            try {
                const sockets = await io.in(`room_${accessCode}`).fetchSockets();
                debug.socketConnections = sockets.map(socket => ({
                    id: socket.id,
                    rooms: Array.from(socket.rooms),
                    connected: socket.connected
                }));

                // 3. Kiểm tra adapter rooms
                const adapters = io.sockets.adapter;
                if (adapters && adapters.rooms) {
                    const adapterRoom = adapters.rooms.get(`room_${accessCode}`);
                    debug.adapterRooms = adapterRoom ? {
                        size: adapterRoom.size,
                        sockets: Array.from(adapterRoom)
                    } : null;
                }
            } catch (ioError) {
                debug.socketError = ioError.message;
            }
        }

        // 4. Kiểm tra database
        try {
            const roomSession = await RoomSession.findOne({
                where: { accessCode }
            });
            debug.databaseRoom = roomSession ? {
                id: roomSession.id,
                status: roomSession.status,
                clientConnected: roomSession.clientConnected,
                displayConnected: roomSession.displayConnected,
                expiredAt: roomSession.expiredAt
            } : null;
        } catch (dbError) {
            debug.databaseError = dbError.message;
        }

        res.json(debug);

    } catch (error) {
        logger.error('Error in debugRoomConnections:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi debug room connections',
            error: error.message
        });
    }
};

/**
 * Force cleanup một phòng hoàn toàn
 * @route POST /api/room-sessions/force-cleanup/:accessCode
 * @access Private/Admin
 */
const forceCleanupRoom = async (req, res) => {
    try {
        const { accessCode } = req.params;
        const io = req.app.get('io');
        const rooms = req.app.get('rooms');
        const roomTimeouts = req.app.get('roomTimeouts');
        
        let cleanupActions = [];
        let errors = [];

        // 1. Force disconnect tất cả sockets
        if (io) {
            try {
                const sockets = await io.fetchSockets();
                const roomSockets = sockets.filter(socket => 
                    socket.rooms.has(`room_${accessCode}`)
                );

                for (const socket of roomSockets) {
                    try {
                        socket.rooms.clear();
                        if (socket.conn) socket.conn.close();
                        socket.disconnect(true);
                        cleanupActions.push(`Disconnected socket: ${socket.id}`);
                    } catch (err) {
                        errors.push(`Failed to disconnect socket ${socket.id}: ${err.message}`);
                    }
                }

                // Clear adapter rooms
                const adapter = io.sockets.adapter;
                if (adapter && adapter.rooms) {
                    adapter.rooms.delete(`room_${accessCode}`);
                    cleanupActions.push('Cleared Socket.IO adapter room');
                }

            } catch (ioError) {
                errors.push(`IO Error: ${ioError.message}`);
            }
        }

        // 2. Clear memory
        if (rooms && rooms.has(accessCode)) {
            const room = rooms.get(accessCode);
            room.clients.clear();
            room.adminClients.clear();
            room.displayClients.clear();
            rooms.delete(accessCode);
            cleanupActions.push('Cleared memory room and all client sets');
        }

        // 3. Clear timeouts
        if (roomTimeouts) {
            let timeoutsCleaned = 0;
            for (const [key, timeoutId] of roomTimeouts.entries()) {
                if (key === accessCode || key.includes(accessCode)) {
                    clearTimeout(timeoutId);
                    roomTimeouts.delete(key);
                    timeoutsCleaned++;
                }
            }
            cleanupActions.push(`Cleared ${timeoutsCleaned} timeouts`);
        }

        // 4. Update database
        try {
            await Promise.all([
                RoomSession.update(
                    { 
                        status: 'expired',
                        clientConnected: [],
                        displayConnected: []
                    },
                    { where: { accessCode } }
                ),
                AccessCode.update(
                    { status: 'expired' },
                    { where: { code: accessCode } }
                )
            ]);
            cleanupActions.push('Updated database status to expired');
        } catch (dbError) {
            errors.push(`Database Error: ${dbError.message}`);
        }

        res.json({
            success: true,
            message: 'Force cleanup completed',
            accessCode,
            actions: cleanupActions,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        logger.error('Error in forceCleanupRoom:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi force cleanup room',
            error: error.message
        });
    }
};

/**
 * Xóa tất cả các phòng đã hết hạn
 * @route DELETE /api/room-sessions/expired
 * @access Private/Admin
 */
const deleteExpiredRooms = async (req, res) => {
    try {
        const io = req.app.get('io');
        const rooms = req.app.get('rooms');
        const roomTimeouts = req.app.get('roomTimeouts');
        
        // Lấy các phòng hết hạn từ database
        const expiredSessions = await RoomSession.findAll({
            where: { 
                status: 'expired'
            }
        });

        let cleanedRooms = 0;
        let disconnectedClients = 0;

        for (const session of expiredSessions) {
            const accessCode = session.accessCode;
            
            try {
                // Ngắt kết nối tất cả client trong phòng hết hạn
                if (io) {
                    const sockets = await io.in(`room_${accessCode}`).fetchSockets();
                    for (const socket of sockets) {
                        socket.leave(`room_${accessCode}`);
                        socket.disconnect(true);
                        disconnectedClients++;
                    }
                }

                // Xóa phòng khỏi bộ nhớ
                if (rooms && rooms.has(accessCode)) {
                    rooms.delete(accessCode);
                }

                // Xóa timeout
                if (roomTimeouts && roomTimeouts.has(accessCode)) {
                    clearTimeout(roomTimeouts.get(accessCode));
                    roomTimeouts.delete(accessCode);
                }

                cleanedRooms++;
                logger.info(`Cleaned expired room: ${accessCode}`);

            } catch (error) {
                logger.error(`Error cleaning expired room ${accessCode}:`, error);
            }
        }

        // Xóa record khỏi database
        await RoomSession.destroy({
            where: { status: 'expired' }
        });

        res.json({
            success: true,
            message: 'Đã dọn dẹp tất cả phòng hết hạn',
            cleanedRooms: cleanedRooms,
            disconnectedClients: disconnectedClients
        });

    } catch (error) {
        logger.error('Error cleaning expired rooms:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi dọn dẹp phòng hết hạn',
            error: error.message
        });
    }
};

/**
 * Lấy lịch sử các phòng đã hết hạn (10 phòng gần nhất)
 * @route GET /api/room-sessions/history
 * @access Public
 */
const getHistoryMatches = async (req, res) => {
    try {
        // Lấy 10 phòng gần nhất có status là 'expired'
        const expiredRooms = await RoomSession.findAll({
            where: {
                status: 'expired'
            },
            order: [['expiredAt', 'DESC']],
            limit: 10,
            include: [
                {
                    association: 'accessCodeInfo',
                    attributes: ['code', 'status', 'expiredAt']
                },
                {
                    model: DisplaySetting,
                    as: 'displaySettings',
                    attributes: ['id', 'type', 'code_logo', 'type_display', 'position', 'url_logo', 'metadata']
                }
            ]
        });

        // Format lại dữ liệu trả về
        const formattedRooms = expiredRooms.map(room => ({
            id: room.id,
            accessCode: room.accessCode,
            status: room.status,
            expiredAt: room.expiredAt,
            displaySettings: room.displaySettings || []
        }));

        res.json({
            success: true,
            data: formattedRooms,
            count: formattedRooms.length
        });
    } catch (error) {
        console.error('Error fetching history matches:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch sử các trận đấu',
            error: error.message
        });
    }
};

module.exports = {
    getAllRoomSessions,
    getRoomSessionById,
    getRoomSessionByAccessCode,
    getActiveRoomSessions,
    deleteRoom,
    disconnectClient,
    debugRoomConnections,
    forceCleanupRoom,
    deleteExpiredRooms,
    getHistoryMatches
};