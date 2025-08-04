const { Op } = require('sequelize');
const Match = require('../models/Match');
const AccessCode = require('../models/AccessCode');
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

// Get match by access code
exports.getMatchByAccessCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Find the access code
    const accessCode = await AccessCode.findOne({
      where: { 
        code,
        status: 'active',
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [
        {
          model: Match,
          as: 'match',
          required: true
        }
      ]
    });

    if (!accessCode) {
      return next(new ApiError('Mã truy cập không hợp lệ hoặc đã hết hạn', StatusCodes.NOT_FOUND));
    }

    // If we found a valid access code and match, return the match data
    res.status(StatusCodes.OK).json({ 
      success: true, 
      data: accessCode.match 
    });
  } catch (error) {
    logger.error(`Get match by access code error: ${error.message}`);
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

// Update live unit for match
exports.updateLiveUnit = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { liveUnit } = req.body;
    
    const match = await Match.findByPk(matchId);
    if (!match) {
      return next(new ApiError('Không tìm thấy trận đấu', StatusCodes.NOT_FOUND));
    }
    
    // Kiểm tra quyền truy cập
    if (match.userId !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền cập nhật trận đấu này', StatusCodes.FORBIDDEN));
    }
    
    // Cập nhật liveUnit
    match.liveUnit = liveUnit || null;
    await match.save();
    
    // Trả về dữ liệu đã cập nhật
    res.status(StatusCodes.OK).json({ 
      success: true, 
      data: { liveUnit: match.liveUnit } 
    });
  } catch (error) {
    logger.error(`Update live unit error: ${error.message}`);
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
