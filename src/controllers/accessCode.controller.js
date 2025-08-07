const { Op, Sequelize } = require('sequelize');
const AccessCode = require('../models/AccessCode');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { startOfDay, endOfDay } = require('date-fns');

/**
 * @desc    Tạo mới access code và match (nếu chưa có matchId)
 * @route   POST /api/v1/access-codes
 * @access  Private
 */
exports.createAccessCode = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Request body:', req.body);
    const { typeMatch, maxUses = 1, metadata = {}, expiredAt } = req.body;
    
    if (!typeMatch) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'typeMatch is required');
    }

    // Tạo mới match với các giá trị mặc định
    const match = await Match.create({
      teamAName: 'Team A',
      teamBName: 'Team B',
      teamALogo: '/images/default-team-logo.png',
      teamBLogo: '/images/default-team-logo.png',
      tournamentName: '',
      tournamentLogo: '',
      typeMatch,
      createdBy: req.user.id,
      matchDate: new Date(),
      status: 'upcoming',
      homeScore: 0,
      awayScore: 0,
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 }
    }, { transaction });

    // Tìm tất cả access code active của user trong ngày hiện tại
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    
    const activeAccessCodesToday = await AccessCode.count({
      where: {
        createdBy: req.user.id,
        status: 'active',
        createdAt: {
          [Op.between]: [startOfToday, endOfToday]
        }
      }
    });

    // Kiểm tra giới hạn (tối đa 3 access code active trong 1 ngày)
    const MAX_ACTIVE_CODES_PER_DAY = 3;
    let newAccessCodeStatus = 'active';
    
    if (activeAccessCodesToday >= MAX_ACTIVE_CODES_PER_DAY) {
      newAccessCodeStatus = 'inactive';
    }

    // Tạo mới access code với status được xác định
    const accessCode = await AccessCode.create({
      code: AccessCode.generateCode(typeMatch),
      status: newAccessCodeStatus,
      createdBy: req.user.id,
      matchId: match.id,
      maxUses: parseInt(maxUses, 10) || 1,
      usageCount: 0,
      metadata: metadata || {},
      expiredAt: expiredAt ? new Date(expiredAt) : null
    }, { transaction });

    // Nếu không có expiredAt, đặt mặc định 30 ngày
    if (!expiredAt) {
      await accessCode.setExpiry(30, transaction);
    }

    await transaction.commit();

    const response = {
      success: true,
      data: accessCode.toJSON(),
      message: newAccessCodeStatus === 'inactive' 
        ? `Access code đã được tạo nhưng ở trạng thái inactive vì bạn đã có ${MAX_ACTIVE_CODES_PER_DAY} access code active trong ngày hôm nay`
        : 'Access code đã được tạo thành công'
    };

    if (match) {
      response.match = match.toJSON();
    }

    // Thêm thông tin về giới hạn vào response
    response.dailyLimit = {
      maxActiveCodesPerDay: MAX_ACTIVE_CODES_PER_DAY,
      currentActiveCount: newAccessCodeStatus === 'active' ? activeAccessCodesToday + 1 : activeAccessCodesToday,
      remainingSlots: newAccessCodeStatus === 'active' ? MAX_ACTIVE_CODES_PER_DAY - activeAccessCodesToday - 1 : MAX_ACTIVE_CODES_PER_DAY - activeAccessCodesToday
    };

    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    await transaction.rollback();
    logger.error(`Create access code error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Cập nhật thông tin trận đấu của access code
 * @route   PUT /api/v1/access-codes/:code/match
 * @access  Private
 */
exports.updateMatchInfo = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { code } = req.params;
    const {
      teamAName,
      teamBName,
      teamALogo,
      teamBLogo,
      tournamentName,
      tournamentLogo,
      typeMatch,
      matchDate
    } = req.body;

    // Tìm access code
    const accessCode = await AccessCode.findOne({
      where: { code },
      include: [{
        model: Match,
        as: 'match'
      }]
    });

    if (!accessCode) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Access code không tồn tại');
    }

    if (!accessCode.match) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thông tin trận đấu');
    }

    const updateData = {};
    if (teamAName) updateData.teamAName = teamAName;
    if (teamBName) updateData.teamBName = teamBName;
    if (teamALogo) updateData.teamALogo = teamALogo;
    if (teamBLogo) updateData.teamBLogo = teamBLogo;
    if (tournamentName) updateData.tournamentName = tournamentName;
    if (tournamentLogo) updateData.tournamentLogo = tournamentLogo;
    if (typeMatch) updateData.typeMatch = typeMatch;
    if (matchDate) updateData.matchDate = new Date(matchDate);

    await accessCode.match.update(updateData, { transaction });
    await transaction.commit();

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...accessCode.match.toJSON(),
        matchName: accessCode.match.matchName 
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * @desc    Lấy thông tin trận đấu của access code
 * @route   GET /api/v1/access-codes/:code/match
 * @access  Private
 */
exports.getMatchInfo = async (req, res, next) => {
  try {
    const { code } = req.params;

    const accessCode = await AccessCode.findOne({
      where: { code },
      include: [{
        model: Match,
        as: 'match'
      }]
    });

    if (!accessCode) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Access code không tồn tại');
    }

    if (!accessCode.match) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thông tin trận đấu');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...accessCode.match.toJSON(),
        matchName: accessCode.match.matchName // Đảm bảo trả về matchName đã được tính toán
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lấy danh sách access codes
 * @route   GET /api/v1/access-codes
 * @access  Private
 */
exports.getAccessCodes = async (req, res, next) => {
  // Check if response was already sent
  if (res.headersSent) {
    logger.warn('Response already sent, aborting getAccessCodes');
    return;
  }

  try {
    const { status, matchId, createdBy, page = 1, limit = 10 } = req.query;
    
    // Validate input
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    
    if (pageNum < 1 || limitNum < 1) {
      return next(new ApiError('Số trang và giới hạn phải lớn hơn 0', StatusCodes.BAD_REQUEST));
    }

    const where = {};
    
    if (status && status !== 'undefined' && status !== 'null' && status !== '') {
      where.status = status;
    } else if (status === '') {
      delete where.status;
    }
    
    if (matchId) {
      where.matchId = matchId;
    }
    
    if (createdBy) {
      where.createdBy = createdBy;
    }
    
    if (req.user.role !== 'admin') {
      try {
        const userMatches = await Match.findAll({
          where: { createdBy: req.user.id },
          attributes: ['id']
        });
        
        const userMatchIds = userMatches.map(match => match.id);
        
        if (userMatchIds.length === 0) {
          where.createdBy = req.user.id;
        } else {
          where[Op.or] = [
            { createdBy: req.user.id },
            { matchId: { [Op.in]: userMatchIds } }
          ];
        }
      } catch (dbError) {
        logger.error(`Error fetching user matches: ${dbError.message}`);
        return next(new ApiError('Lỗi khi tải dữ liệu', StatusCodes.INTERNAL_SERVER_ERROR));
      }
    }

    // Check if response was already sent (double check)
    if (res.headersSent) {
      logger.warn('Response already sent before database query');
      return;
    }

    // Execute paginated query
    const { count, rows: accessCodes } = await AccessCode.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    });

    // Get match info for each access code
    const accessCodesWithMatch = [];
    
    for (const accessCode of accessCodes) {
      try {
        let matchInfo = null;
        if (accessCode.matchId) {
          const match = await Match.findByPk(accessCode.matchId, {
            attributes: ['id', 'teamAName', 'teamBName', 'typeMatch', 'matchDate', 'status']
          });
          matchInfo = match ? match.toJSON() : null;
        }
        accessCodesWithMatch.push({
          ...accessCode.toJSON(),
          match: matchInfo
        });
      } catch (matchError) {
        logger.error(`Error fetching match for access code ${accessCode.id}: ${matchError.message}`);
        accessCodesWithMatch.push({
          ...accessCode.toJSON(),
          match: null
        });
      }
    }

    // Final check before sending response
    if (res.headersSent) {
      logger.warn('Response already sent before sending final response');
      return;
    }

    // Send response
    return res.status(StatusCodes.OK).json({
      success: true,
      count,
      data: accessCodesWithMatch,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(count / limitNum),
        totalItems: count,
        itemsPerPage: limitNum
      }
    });
      
  } catch (error) {
    if (res.headersSent) {
      logger.error('Error occurred but headers already sent:', error);
      return;
    }
    logger.error(`Unexpected error in getAccessCodes: ${error.message}`, { error });
    return next(new ApiError('Đã xảy ra lỗi không mong muốn', StatusCodes.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @desc    Lấy thông tin chi tiết access code
 * @route   GET /api/v1/access-codes/:code
 * @access  Private
 */
exports.getAccessCode = async (req, res, next) => {
  try {
    const accessCode = await AccessCode.findOne({
      where: { code: req.params.code },
      include: [{
        model: Match,
        as: 'match'
      }]
    });

    if (!accessCode) {
      return next(new ApiError('Không tìm thấy access code', StatusCodes.NOT_FOUND));
    }

    // Kiểm tra quyền truy cập
    if (accessCode.createdBy !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền truy cập access code này', StatusCodes.FORBIDDEN));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: accessCode
    });
  } catch (error) {
    logger.error(`Get access code error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Cập nhật access code
 * @route   PUT /api/v1/access-codes/:id
 * @access  Private
 */
exports.updateAccessCode = async (req, res, next) => {
  try {
    const accessCode = await AccessCode.findByPk(req.params.id);

    if (!accessCode) {
      return next(new ApiError('Không tìm thấy access code', StatusCodes.NOT_FOUND));
    }

    // Kiểm tra quyền sở hữu
    if (accessCode.createdBy !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền cập nhật access code này', StatusCodes.FORBIDDEN));
    }

    const { status, expiredAt, maxUses, metadata } = req.body;
    
    // Kiểm tra giá trị status hợp lệ
    const validStatuses = ['active', 'used', 'expired', 'revoked'];
    if (status) {
      if (!validStatuses.includes(status)) {
        return next(new ApiError(`Trạng thái không hợp lệ. Các giá trị cho phép: ${validStatuses.join(', ')}`, StatusCodes.BAD_REQUEST));
      }
      accessCode.status = status;
    }
    if (expiredAt) accessCode.expiredAt = new Date(expiredAt);
    if (maxUses !== undefined) accessCode.maxUses = maxUses;
    if (metadata) accessCode.metadata = { ...accessCode.metadata, ...metadata };
    
    await accessCode.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: accessCode
    });
  } catch (error) {
    logger.error(`Update access code error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Xóa access code
 * @route   DELETE /api/v1/access-codes/:id
 * @access  Private
 */
exports.deleteAccessCode = async (req, res, next) => {
  try {
    const accessCode = await AccessCode.findByPk(req.params.id);

    if (!accessCode) {
      return next(new ApiError('Không tìm thấy access code', StatusCodes.NOT_FOUND));
    }

    // Kiểm tra quyền sở hữu
    if (accessCode.createdBy !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError('Không có quyền xóa access code này', StatusCodes.FORBIDDEN));
    }

    await accessCode.destroy();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đã xóa access code thành công',
      data: {}
    });
  } catch (error) {
    logger.error(`Delete access code error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Sử dụng access code
 * @route   POST /api/v1/access-codes/:code/use
 * @access  Private
 */
exports.useAccessCode = async (req, res, next) => {
  try {
    const accessCode = await AccessCode.findOne({
      where: { code: req.params.code }
    });

    if (!accessCode) {
      return next(new ApiError('Access code không hợp lệ', StatusCodes.NOT_FOUND));
    }

    // Kiểm tra trạng thái code
    if (accessCode.status !== 'active') {
      return next(new ApiError('Access code không còn hiệu lực', StatusCodes.BAD_REQUEST));
    }

    // Kiểm tra hạn sử dụng
    if (accessCode.expiredAt && new Date() > new Date(accessCode.expiredAt)) {
      accessCode.status = 'expired';
      await accessCode.save();
      return next(new ApiError('Access code đã hết hạn', StatusCodes.BAD_REQUEST));
    }

    // Kiểm tra số lần sử dụng
    if (accessCode.usageCount >= accessCode.maxUses) {
      accessCode.status = 'used';
      await accessCode.save();
      return next(new ApiError('Access code đã đạt giới hạn sử dụng', StatusCodes.BAD_REQUEST));
    }

    // Cập nhật số lần sử dụng
    accessCode.usageCount += 1;
    accessCode.lastUsedAt = new Date();
    accessCode.usedBy = req.user.id;
    
    // Nếu đã đạt giới hạn sử dụng, đánh dấu là đã dùng hết
    if (accessCode.usageCount >= accessCode.maxUses) {
      accessCode.status = 'used';
    }
    
    await accessCode.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Sử dụng access code thành công',
      data: {
        matchId: accessCode.matchId,
        remainingUses: accessCode.maxUses - accessCode.usageCount
      }
    });
  } catch (error) {
    logger.error(`Use access code error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Xác minh access code có hợp lệ không
 * @route   GET /api/v1/access-codes/:code/verify-login
 * @access  Public
 */
exports.verifyAccessCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return next(new ApiError('Vui lòng cung cấp mã truy cập', StatusCodes.BAD_REQUEST));
    }

    // Tìm access code
    const accessCode = await AccessCode.findOne({
      where: { code },
      include: [{
        model: Match,
        as: 'match',
        attributes: ['id', 'teamAName', 'teamBName', 'teamALogo', 'teamBLogo', 'tournamentName', 'tournamentLogo', 'status', 'matchDate']
      }]
    });

    if (!accessCode) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Mã truy cập không tồn tại',
        isValid: false
      });
    }

    // Kiểm tra các trạng thái KHÔNG được phép truy cập
    const statusMessages = {
      'inactive': 'Mã truy cập chưa được kích hoạt. Vui lòng nạp tiền để sử dụng',
      'expired': 'Mã truy cập đã hết hạn',
      'revoked': 'Mã truy cập đã bị thu hồi'
    };

    if (['inactive', 'expired', 'revoked'].includes(accessCode.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: statusMessages[accessCode.status],
        isValid: false,
        status: accessCode.status
      });
    }

    // Kiểm tra thời hạn cho cả 'active' và 'used'
    if (accessCode.expiredAt && new Date(accessCode.expiredAt) < new Date()) {
      // Cập nhật trạng thái nếu đã hết hạn
      await accessCode.update({ status: 'expired' });
      
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Mã truy cập đã hết hạn',
        isValid: false,
        status: 'expired'
      });
    }

    // Kiểm tra số lần sử dụng - CHỈ WARNING, không block
    let warningMessage = null;
    if (accessCode.maxUses > 0 && accessCode.usedCount >= accessCode.maxUses) {
      warningMessage = 'Mã truy cập đã đạt giới hạn sử dụng nhưng vẫn có thể truy cập';
    }

    // CHỈ cho phép 'active' và 'used' truy cập
    if (accessCode.status === 'active' || accessCode.status === 'used') {
      
      // Tính toán thời gian còn lại
      let timeRemaining = null;
      let timeRemainingMessage = null;
      
      if (accessCode.expiredAt) {
        const now = new Date();
        const expiredAt = new Date(accessCode.expiredAt);
        const diffMs = expiredAt.getTime() - now.getTime();
        
        if (diffMs > 0) {
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          if (days > 0) {
            timeRemainingMessage = `${days} ngày ${hours} giờ`;
          } else if (hours > 0) {
            timeRemainingMessage = `${hours} giờ ${minutes} phút`;
          } else {
            timeRemainingMessage = `${minutes} phút`;
          }
          
          timeRemaining = {
            days,
            hours,
            minutes,
            totalMinutes: Math.floor(diffMs / (1000 * 60))
          };
        }
      }

      const responseData = {
        success: true,
        message: accessCode.status === 'active' 
          ? 'Mã truy cập hợp lệ - Phòng mới (30 ngày)' 
          : 'Mã truy cập hợp lệ - Phòng đang hoạt động (2 tiếng)',
        isValid: true,
        data: {
          code: accessCode.code,
          status: accessCode.status,
          expiredAt: accessCode.expiredAt,
          usedCount: accessCode.usedCount || 0,
          maxUses: accessCode.maxUses || 0,
          match: accessCode.match,
          isNewRoom: accessCode.status === 'active', // Phòng mới (30 ngày)
          isExistingRoom: accessCode.status === 'used', // Phòng đã có (2 tiếng)
          timeRemaining: timeRemaining,
          timeRemainingText: timeRemainingMessage
        }
      };

      // Thêm warning message nếu có
      if (warningMessage) {
        responseData.warning = warningMessage;
      }

      return res.status(StatusCodes.OK).json(responseData);
    }

    // Trường hợp status không xác định (không nên xảy ra)
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Trạng thái mã truy cập không hợp lệ: ${accessCode.status}`,
      isValid: false,
      status: accessCode.status
    });

  } catch (error) {
    next(new ApiError(`Lỗi khi xác minh mã truy cập: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR));
  }
};