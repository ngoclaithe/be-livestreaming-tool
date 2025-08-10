const { Op } = require('sequelize');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { PlayerList, AccessCode } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Tạo mới hoặc cập nhật danh sách cầu thủ
 * - accessCode: Mã truy cập của phòng
 * - teamType: 'teamA' hoặc 'teamB'
 * - players: Mảng danh sách cầu thủ
 */
exports.createOrUpdatePlayerList = async (req, res, next) => {
  try {
    const { accessCode, teamType, players } = req.body;
    
    const accessCodeRecord = await AccessCode.findOne({
      where: { code: accessCode },
      include: ['match']
    });

    if (!accessCodeRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Mã truy cập không hợp lệ');
    }

    const [playerList, created] = await PlayerList.findOrCreate({
      where: { accessCode, teamType },
      defaults: { players },
      include: [{
        model: AccessCode,
        as: 'accessCodeData',
        include: ['match']
      }]
    });

    if (!created) {
      playerList.players = players;
      await playerList.save();
    }

    const matchInfo = accessCodeRecord.match ? {
      teamAName: accessCodeRecord.match.teamAName,
      teamBName: accessCodeRecord.match.teamBName,
      matchDate: accessCodeRecord.match.matchDate
    } : null;

    res.status(created ? StatusCodes.CREATED : StatusCodes.OK).json({
      success: true,
      data: {
        ...playerList.get({ plain: true }),
        matchInfo
      }
    });
  } catch (error) {
    logger.error(`Xử lý danh sách cầu thủ thất bại: ${error.message}`);
    next(error);
  }
};


exports.getPlayerList = async (req, res, next) => {
  try {
    const { accessCode, teamType } = req.params;
    
    const playerList = await PlayerList.findOne({
      where: { accessCode, teamType },
      include: [{
        model: AccessCode,
        as: 'accessCodeData',
        include: ['match']
      }]
    });

    if (!playerList) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy danh sách cầu thủ');
    }

    const matchInfo = playerList.accessCodeData?.match ? {
      teamAName: playerList.accessCodeData.match.teamAName,
      teamBName: playerList.accessCodeData.match.teamBName,
      matchDate: playerList.accessCodeData.match.matchDate
    } : null;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...playerList.get({ plain: true }),
        matchInfo
      }
    });
  } catch (error) {
    logger.error(`Lấy danh sách cầu thủ thất bại: ${error.message}`);
    next(error);
  }
};

exports.deletePlayerList = async (req, res, next) => {
  try {
    const { accessCode, teamType } = req.params;
    
    const result = await PlayerList.destroy({
      where: { accessCode, teamType }
    });
    
    if (result === 0) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy danh sách cầu thủ để xóa');
    }
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đã xóa danh sách cầu thủ thành công'
    });
  } catch (error) {
    logger.error(`Xóa danh sách cầu thủ thất bại: ${error.message}`);
    next(error);
  }
};

/**
 * Lấy danh sách 10 player list gần nhất kèm thông tin đội
 */
exports.getRecentPlayerLists = async (req, res, next) => {
  try {
    const recentPlayerLists = await PlayerList.findAll({
      order: [['createdAt', 'DESC']],
      limit: 20, 
      include: [{
        model: AccessCode,
        as: 'accessCodeData',
        include: ['match']
      }]
    });

    const groupedByAccessCode = recentPlayerLists.reduce((acc, list) => {
      if (!acc[list.accessCode]) {
        acc[list.accessCode] = {
          accessCode: list.accessCode,
          matchInfo: list.accessCodeData?.match ? {
            teamAName: list.accessCodeData.match.teamAName,
            teamBName: list.accessCodeData.match.teamBName,
            matchDate: list.accessCodeData.match.matchDate
          } : null,
          playerLists: []
        };
      }
      
      acc[list.accessCode].playerLists.push({
        teamType: list.teamType,
        players: list.players
      });
      
      return acc;
    }, {});

    const result = Object.values(groupedByAccessCode)
      .sort((a, b) => new Date(b.matchInfo?.matchDate || 0) - new Date(a.matchInfo?.matchDate || 0))
      .slice(0, 10);

    res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Lấy danh sách cầu thủ gần đây thất bại: ${error.message}`);
    next(error);
  }
};
