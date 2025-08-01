const { DisplaySetting, AccessCode } = require('../models');
const { Op } = require('sequelize');

// Tạo mới nhiều display settings cùng lúc
const createDisplaySetting = async (req, res) => {
  try {
    const { items, accessCode } = req.body;

    // Kiểm tra access code tồn tại
    const accessCodeExists = await AccessCode.findOne({
      where: { code: accessCode }
    });

    if (!accessCodeExists) {
      return res.status(404).json({
        success: false,
        message: 'Access code not found',
      });
    }

    // Kiểm tra items có phải là mảng không
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items must be a non-empty array',
      });
    }

    // Tạo mới nhiều bản ghi cùng lúc
    const displaySettings = await DisplaySetting.bulkCreate(
      items.map(item => ({
        ...item,
        accessCode, // Thêm accessCode vào từng item
      }))
    );

    return res.status(201).json({
      success: true,
      data: displaySettings,
      count: displaySettings.length,
    });
  } catch (error) {
    console.error('Error creating display settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get all display settings
const getDisplaySettings = async (req, res) => {
  try {
    const { accessCode } = req.query;
    
    const whereClause = {};
    if (accessCode) {
      whereClause.accessCode = accessCode;
    }

    const displaySettings = await DisplaySetting.findAll({
      where: whereClause,
      include: [
        {
          model: AccessCode,
          as: 'accessCodeData',
          attributes: ['code', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: displaySettings,
    });
  } catch (error) {
    console.error('Error getting display settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get display setting by ID
const getDisplaySettingById = async (req, res) => {
  try {
    const { id } = req.params;

    const displaySetting = await DisplaySetting.findByPk(id, {
      include: [
        {
          model: AccessCode,
          as: 'accessCodeData',
          attributes: ['code', 'status']
        }
      ]
    });

    if (!displaySetting) {
      return res.status(404).json({
        success: false,
        message: 'Display setting not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: displaySetting,
    });
  } catch (error) {
    console.error('Error getting display setting:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Update display setting
const updateDisplaySetting = async (req, res) => {
  try {
    const { id } = req.params;
    const { code_logo, type_display, position, url_logo, accessCode } = req.body;

    const displaySetting = await DisplaySetting.findByPk(id);

    if (!displaySetting) {
      return res.status(404).json({
        success: false,
        message: 'Display setting not found',
      });
    }

    // If accessCode is being updated, verify it exists
    if (accessCode && accessCode !== displaySetting.accessCode) {
      const accessCodeExists = await AccessCode.findOne({
        where: { code: accessCode }
      });

      if (!accessCodeExists) {
        return res.status(404).json({
          success: false,
          message: 'Access code not found',
        });
      }
    }

    await displaySetting.update({
      code_logo: code_loggo || displaySetting.code_logo,
      type_display: type_display || displaySetting.type_display,
      position: position || displaySetting.position,
      url_logo: url_logo !== undefined ? url_logo : displaySetting.url_logo,
      accessCode: accessCode || displaySetting.accessCode,
    });

    return res.status(200).json({
      success: true,
      data: displaySetting,
    });
  } catch (error) {
    console.error('Error updating display setting:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Delete display setting
const deleteDisplaySetting = async (req, res) => {
  try {
    const { id } = req.params;

    const displaySetting = await DisplaySetting.findByPk(id);

    if (!displaySetting) {
      return res.status(404).json({
        success: false,
        message: 'Display setting not found',
      });
    }

    await displaySetting.destroy();

    return res.status(200).json({
      success: true,
      message: 'Display setting deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting display setting:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get display settings by access code
const getDisplaySettingsByAccessCode = async (req, res) => {
  try {
    const { accessCode } = req.params;

    // Verify access code exists
    const accessCodeExists = await AccessCode.findOne({
      where: { code: accessCode }
    });

    if (!accessCodeExists) {
      return res.status(404).json({
        success: false,
        message: 'Access code not found'
      });
    }

    const whereClause = { accessCode };
    const { type } = req.query;
    
    if (type) {
      whereClause.type = type;
    }

    const settings = await DisplaySetting.findAll({
      where: whereClause,
      order: [['position', 'ASC'], ['createdAt', 'ASC']],
    });

    // Nhóm kết quả theo type nếu không chỉ định type cụ thể
    const result = type ? settings : settings.reduce((acc, setting) => {
      if (!acc[setting.type]) {
        acc[setting.type] = [];
      }
      acc[setting.type].push(setting);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: type ? settings : result,
      count: settings.length,
    });
  } catch (error) {
    console.error('Error getting display settings by access code:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  createDisplaySetting,
  getDisplaySettings,
  getDisplaySettingById,
  updateDisplaySetting,
  deleteDisplaySetting,
  getDisplaySettingsByAccessCode,
};
