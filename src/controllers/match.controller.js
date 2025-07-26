const { Op } = require('sequelize');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

// Create a new match
exports.createMatch = async (req, res, next) => {
  try {
    const matchData = { ...req.body, userId: req.user.id };
    if (matchData.matchDate) matchData.matchDate = new Date(matchData.matchDate);
    
    const match = await Match.create(matchData);
    res.status(StatusCodes.CREATED).json({ success: true, data: match });
  } catch (error) {
    logger.error(`Create match error: ${error.message}`);
    next(error);
  }
};

// Get all matches with filtering
exports.getMatches = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo, teamName, tournament, page = 1, limit = 10 } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.matchDate = {};
      if (dateFrom) where.matchDate[Op.gte] = new Date(dateFrom);
      if (dateTo) where.matchDate[Op.lte] = new Date(dateTo);
    }
    if (teamName) {
      where[Op.or] = [
        { homeTeam: { [Op.iLike]: `%${teamName}%` } },
        { awayTeam: { [Op.iLike]: `%${teamName}%` } }
      ];
    }
    if (tournament) where.tournamentName = { [Op.iLike]: `%${tournament}%` };

    const { count, rows: matches } = await Match.findAndCountAll({
      where,
      order: [['matchDate', 'ASC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count,
      data: matches,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count
      }
    });
  } catch (error) {
    logger.error(`Get matches error: ${error.message}`);
    next(error);
  }
};

// Get single match by ID
exports.getMatch = async (req, res, next) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return next(new ApiError('Không tìm thấy trận đấu', StatusCodes.NOT_FOUND));
    res.status(StatusCodes.OK).json({ success: true, data: match });
  } catch (error) {
    logger.error(`Get match error: ${error.message}`);
    next(error);
  }
};

// Update match
exports.updateMatch = async (req, res, next) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return next(new ApiError('Không tìm thấy trận đấu', StatusCodes.NOT_FOUND));
    if (match.userId !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền cập nhật trận đấu này', StatusCodes.FORBIDDEN));
    }
    
    const updateData = { ...req.body };
    if (updateData.matchDate) updateData.matchDate = new Date(updateData.matchDate);
    
    await match.update(updateData);
    res.status(StatusCodes.OK).json({ success: true, data: match });
  } catch (error) {
    logger.error(`Update match error: ${error.message}`);
    next(error);
  }
};

// Delete match
exports.deleteMatch = async (req, res, next) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return next(new ApiError('Không tìm thấy trận đấu', StatusCodes.NOT_FOUND));
    if (match.userId !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền xóa trận đấu này', StatusCodes.FORBIDDEN));
    }
    
    await match.destroy();
    res.status(StatusCodes.OK).json({ success: true, message: 'Đã xóa trận đấu thành công' });
  } catch (error) {
    logger.error(`Delete match error: ${error.message}`);
    next(error);
  }
};

// Update match statistics
exports.updateMatchStats = async (req, res, next) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return next(new ApiError('Không tìm thấy trận đấu', StatusCodes.NOT_FOUND));
    if (match.userId !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền cập nhật thống kê trận đấu này', StatusCodes.FORBIDDEN));
    }
    
    const stats = { ...req.body };
    await match.update(stats);
    res.status(StatusCodes.OK).json({ success: true, data: match });
  } catch (error) {
    logger.error(`Update match stats error: ${error.message}`);
    next(error);
  }
};
