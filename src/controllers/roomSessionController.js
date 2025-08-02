const { RoomSession } = require('../models');

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
                    attributes: ['code', 'status', 'expiresAt']
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
                    attributes: ['code', 'status', 'expiresAt']
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
                    attributes: ['code', 'status', 'expiresAt']
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
                    attributes: ['code', 'status', 'expiresAt']
                }
            ]
        });
        res.json(activeSessions);
    } catch (error) {
        console.error('Error fetching active room sessions:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách room session đang hoạt động' });
    }
};

module.exports = {
    getAllRoomSessions,
    getRoomSessionById,
    getRoomSessionByAccessCode,
    getActiveRoomSessions
};
