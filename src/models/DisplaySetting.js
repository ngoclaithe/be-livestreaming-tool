const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DisplaySetting = sequelize.define('DisplaySetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.ENUM('sponsors', 'organizing', 'media_partners', 'other'),
    allowNull: false,
    comment: 'Loại hiển thị: sponsors, organizing, media_partners, other',
  },
  code_logo: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Mã định danh cho logo',
  },
  type_display: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Kiểu hiển thị (vd: default, special, highlight)',
  },
  position: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Vị trí hiển thị (top-left, top-right, bottom-left, bottom-right, center, etc.)',
  },
  url_logo: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Đường dẫn đến file logo',
  },
  accessCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: 'AccessCodes',
      key: 'code',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    comment: 'Mã truy cập liên kết',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Thông tin bổ sung dạng JSON',
  },
}, {
  timestamps: true,
  tableName: 'DisplaySettings',
  indexes: [
    {
      fields: ['accessCode'],
    },
    {
      fields: ['code_logo'],
    },
  ],
});

DisplaySetting.associate = function(models) {
  DisplaySetting.belongsTo(models.AccessCode, {
    foreignKey: 'accessCode',
    targetKey: 'code',
    as: 'accessCodeData',
  });
};

module.exports = DisplaySetting;
