const Logo = require('../models/Logo');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { deleteFile } = require('../middleware/localUpload');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * @desc    Upload a new logo
 * @route   POST /api/v1/logos
 * @access  Public
 */
exports.uploadLogo = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    console.log('🔥 [Logo Controller] Upload logo started');
    
    if (!req.file) {
      console.log('❌ [Logo Controller] No file uploaded');
      await t.rollback();
      responded = true;
      return next(new ApiError('Vui lòng tải lên một file ảnh', StatusCodes.BAD_REQUEST));
    }

    const { type = 'logo', name } = req.body;
    const logoType = type === 'banner' ? 'banner' : 'logo';
    const logoName = name || logoType; // Default to logo/banner type if name not provided

    const code = await Logo.generateUniqueCode(logoType, t);
    console.log('✅ [Logo Controller] Generated code:', code);

    // Get client IP address
    const uploaderIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('🌐 Uploader IP:', uploaderIp);

    const logo = await Logo.create({
      code_logo: code,
      type_logo: logoType,
      name: logoName,
      url_logo: req.file.fileUrl,
      file_path: req.file.path,
      uploader_ip: uploaderIp
    }, { transaction: t });

    await t.commit();
    responded = true;

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        id: logo.id,
        code_logo: logo.code_logo,
        type_logo: logo.type_logo,
        url_logo: logo.url_logo,
        created_at: logo.createdAt,
        public_url: logo.getPublicUrl()
      }
    });
  } catch (error) {
    if (!t.finished) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        logger.error(`Transaction rollback error: ${rollbackError.message}`);
      }
    } else {
      logger.warn('⚠️ Transaction already committed, skip rollback');
    }

    logger.error(`Upload logo error: ${error.message}`, {
      stack: error.stack,
      user_id: req.user?.id,
      file: req.file?.filename
    });

    if (!responded && !res.headersSent) {
      return next(error);
    } 
  }
};

/**
 * @desc    Get all logos with optional filtering
 * @route   GET /api/v1/logos
 * @access  Public
 */
exports.getLogos = async (req, res, next) => {
  try {
    const { type, search, ip } = req.query;
    const filter = {};
    
    // Filter by IP if provided
    if (ip) {
      filter.uploader_ip = ip;
    }
    
    if (type) {
      filter.type_logo = type;
    }

    if (search) {
      filter.code_logo = {
        [Op.iLike]: `%${search}%`
      };
    }

    const logos = await Logo.findAll({
      where: filter,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'code_logo', 'type_logo', 'url_logo', 'createdAt']
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      count: logos.length,
      data: logos.map(logo => ({
        ...logo.get({ plain: true }),
        public_url: logo.getPublicUrl()
      }))
    });
  } catch (error) {
    logger.error(`Get logos error: ${error.message}`);
    return next(error);
  }
};

/**
 * @desc    Get logo(s) by code (exact match or partial search)
 * @route   GET /api/v1/logos/code/:code
 * @access  Public
 */
exports.getLogoByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { exact = 'false' } = req.query;
    
    if (!code) {
      return next(new ApiError('Vui lòng cung cấp mã logo', StatusCodes.BAD_REQUEST));
    }

    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    
    if (exact === 'true') {
      logger.info(`Searching for exact logo with code: ${cleanCode}`);
      
      const logo = await Logo.findOne({
        where: { code_logo: cleanCode }
      });
      
      if (!logo) {
        logger.warn(`Logo not found with code: ${cleanCode}`);
        return next(new ApiError('Không tìm thấy logo với mã đã cung cấp', StatusCodes.NOT_FOUND));
      }

      const logoData = logo.get({ plain: true });
      logoData.public_url = logo.getPublicUrl();

      return res.status(StatusCodes.OK).json({
        success: true,
        data: [logoData],
        total: 1,
        isExactMatch: true
      });
    }

    // Partial search
    const logos = await Logo.findAll({
      where: {
        code_logo: {
          [Op.iLike]: `${cleanCode}%`
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    if (!logos || logos.length === 0) {
      return next(new ApiError('Không tìm thấy logo nào phù hợp', StatusCodes.NOT_FOUND));
    }

    const logosWithUrls = logos.map(logo => {
      const logoData = logo.get({ plain: true });
      logoData.public_url = logo.getPublicUrl();
      return logoData;
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      data: logosWithUrls,
      total: logosWithUrls.length,
      isExactMatch: false
    });
  } catch (error) {
    logger.error(`Get logo by code error: ${error.message}`, { error });
    return next(error);
  }
};

/**
 * @desc    Get a single logo by ID
 * @route   GET /api/v1/logos/:id
 * @access  Public
 */
exports.getLogo = async (req, res, next) => {
  try {
    const logo = await Logo.findByPk(req.params.id);

    if (!logo) {
      return next(new ApiError('Không tìm thấy logo', StatusCodes.NOT_FOUND));
    }

    const logoData = logo.get({ plain: true });
    logoData.public_url = logo.getPublicUrl();

    return res.status(StatusCodes.OK).json({
      success: true,
      data: logoData
    });
  } catch (error) {
    logger.error(`Get logo error: ${error.message}`);
    return next(error);
  }
};

/**
 * @desc    Update a logo
 * @route   PUT /api/v1/logos/:id
 * @access  Public
 */
exports.updateLogo = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { type, name } = req.body;

    const logo = await Logo.findByPk(id, { transaction: t });

    if (!logo) {
      await t.rollback();
      return next(new ApiError('Không tìm thấy logo', StatusCodes.NOT_FOUND));
    }

    if (req.file) {
      const oldFilePath = logo.file_path;
      logo.url_logo = req.file.fileUrl;
      logo.file_path = req.file.path;
      
      if (oldFilePath) {
        deleteFile(oldFilePath).catch(error => {
          logger.error(`Error deleting old logo file: ${error.message}`);
        });
      }
    }

    // Update type if provided
    if (type) {
      const validTypes = ['logo', 'banner'];
      if (!validTypes.includes(type)) {
        await t.rollback();
        return next(new ApiError('Loại logo không hợp lệ', StatusCodes.BAD_REQUEST));
      }
      logo.type_logo = type;
      
      // If name wasn't explicitly set before, update it to match the new type
      if (!logo.name || logo.name === logo.type_logo) {
        logo.name = type;
      }
    }
    
    // Update name if provided, or set to type if empty
    if (name !== undefined) {
      logo.name = name || logo.type_logo; // If empty string is provided, use type
    }

    await logo.save({ transaction: t });
    await t.commit();

    const logoData = logo.get({ plain: true });
    logoData.public_url = logo.getPublicUrl();

    return res.status(StatusCodes.OK).json({
      success: true,
      data: logoData
    });
  } catch (error) {
    await t.rollback();
    logger.error(`Update logo error: ${error.message}`);
    return next(error);
  }
};

/**
 * @desc    Delete a logo
 * @route   DELETE /api/v1/logos/:id
 * @access  Public
 */
exports.deleteLogo = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const logo = await Logo.findByPk(id, { transaction: t });

    if (!logo) {
      await t.rollback();
      return next(new ApiError('Không tìm thấy logo', StatusCodes.NOT_FOUND));
    }

    const filePath = logo.file_path;
    await logo.destroy({ transaction: t });
    await t.commit();

    if (filePath) {
      deleteFile(filePath).catch(error => {
        logger.error(`Error deleting logo file: ${error.message}`);
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {}
    });
  } catch (error) {
    await t.rollback();
    logger.error(`Delete logo error: ${error.message}`);
    return next(error);
  }
};

console.log('Logo Controller exports:', Object.keys(module.exports));