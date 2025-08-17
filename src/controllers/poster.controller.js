const Poster = require('../models/Poster');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * @desc    Upload a new poster
 * @route   POST /api/v1/posters
 * @access  Public
 */
exports.uploadPoster = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    console.log('🔥 [Poster Controller] Upload poster started');
    
    if (!req.file) {
      console.log('  [Poster Controller] No file uploaded');
      await t.rollback();
      responded = true;
      return next(new ApiError('Vui lòng tải lên một file ảnh', StatusCodes.BAD_REQUEST));
    }

    const { name, description, accessCode } = req.body;
    
    if (!accessCode) {
      console.log('  [Poster Controller] No access code provided');
      await t.rollback();
      responded = true;
      return next(new ApiError('Vui lòng cung cấp mã truy cập', StatusCodes.BAD_REQUEST));
    }
    const filePath = req.file.path.replace(/\\/g, '/');
    
    const newPoster = await Poster.create({
      name: name || req.file.originalname,
      description: description || '',
      accessCode: accessCode,
      file_path: filePath,
      file_name: req.file.filename,
      file_size: req.file.size,
      file_type: req.file.mimetype,
    }, { transaction: t });

    await t.commit();
    console.log('  [Poster Controller] Poster uploaded successfully');
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: newPoster
    });
  } catch (error) {
    if (!responded) {
      await t.rollback();
      console.error('  [Poster Controller] Error uploading poster:', error);
      next(new ApiError('Đã xảy ra lỗi khi tải lên poster', StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }
};

/**
 * @desc    Get all posters with optional filtering
 * @route   GET /api/v1/posters
 * @access  Public
 */
exports.getPosters = async (req, res, next) => {
  try {
    const { name, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    
    const whereClause = {};
    if (name) {
      whereClause.name = { [Op.like]: `%${name}%` };
    }

    const order = [[sortBy, sortOrder.toUpperCase()]];
    
    const posters = await Poster.findAll({
      where: whereClause,
      order,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: posters.length,
      data: posters
    });
  } catch (error) {
    console.error('  [Poster Controller] Error getting posters:', error);
    next(new ApiError('Đã xảy ra lỗi khi lấy danh sách poster', StatusCodes.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @desc    Get a single poster by ID
 * @route   GET /api/v1/posters/:id
 * @access  Public
 */
exports.getPoster = async (req, res, next) => {
  try {
    const poster = await Poster.findByPk(req.params.id);
    
    if (!poster) {
      return next(new ApiError(`Không tìm thấy poster với ID ${req.params.id}`, StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: poster
    });
  } catch (error) {
    console.error(`  [Poster Controller] Error getting poster ${req.params.id}:`, error);
    next(new ApiError(`Đã xảy ra lỗi khi lấy thông tin poster`, StatusCodes.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @desc    Update a poster
 * @route   PUT /api/v1/posters/:id
 * @access  Public
 */
exports.updatePoster = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    const { id } = req.params;
    const { name, description, accessCode } = req.body;
    
    if (accessCode && !accessCode.trim()) {
      await t.rollback();
      responded = true;
      return next(new ApiError('Mã truy cập không hợp lệ', StatusCodes.BAD_REQUEST));
    }
    
    const poster = await Poster.findByPk(id, { transaction: t });
    
    if (!poster) {
      await t.rollback();
      responded = true;
      return next(new ApiError(`Không tìm thấy poster với ID ${id}`, StatusCodes.NOT_FOUND));
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (accessCode) updateData.accessCode = accessCode.trim();

    // Handle file upload if a new file is provided
    if (req.file) {
      // Delete old file if exists
      if (poster.file_path) {
        const { deleteFile } = require('../middleware/localUpload');
        await deleteFile(poster.file_path);
      }
      
      updateData.file_path = req.file.path.replace(/\\/g, '/');
      updateData.file_name = req.file.filename;
      updateData.file_size = req.file.size;
      updateData.file_type = req.file.mimetype;
    }

    await poster.update(updateData, { transaction: t });
    await t.commit();
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: poster
    });
  } catch (error) {
    if (!responded) {
      await t.rollback();
      console.error('  [Poster Controller] Error updating poster:', error);
      next(new ApiError('Đã xảy ra lỗi khi cập nhật poster', StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }
};

/**
 * @desc    Delete a poster
 * @route   DELETE /api/v1/posters/:id
 * @access  Public
 */
exports.deletePoster = async (req, res, next) => {
  const t = await sequelize.transaction();
  let responded = false;

  try {
    const { id } = req.params;
    
    const poster = await Poster.findByPk(id, { transaction: t });
    
    if (!poster) {
      await t.rollback();
      responded = true;
      return next(new ApiError(`Không tìm thấy poster với ID ${id}`, StatusCodes.NOT_FOUND));
    }

    // Delete the file if it exists
    if (poster.file_path) {
      const { deleteFile } = require('../middleware/localUpload');
      await deleteFile(poster.file_path);
    }

    await poster.destroy({ transaction: t });
    await t.commit();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Xóa poster thành công',
      data: {}
    });
  } catch (error) {
    if (!responded) {
      await t.rollback();
      console.error('  [Poster Controller] Error deleting poster:', error);
      next(new ApiError('Đã xảy ra lỗi khi xóa poster', StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }
};
