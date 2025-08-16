const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DisplaySetting = sequelize.define('DisplaySetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.ENUM('sponsors', 'organizing', 'media_partners', 'tournament_logo'),
    allowNull: false,
    comment: 'Loại hiển thị: sponsors, organizing, media_partners, tournament_logo',
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
  currentView: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'View hiện tại (main, scoreboard, bracket, standings, etc.)',
  },
  round: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Số vòng đấu hiện tại',
  },
  group: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Bảng/nhóm đấu (A, B, C, D, etc.)',
  },
  showround: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Hiển thị thông tin vòng đấu (true/false)',
  },
  showgroup: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Hiển thị thông tin bảng đấu (true/false)',
  },
  subtitle: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Phụ đề/tiêu đề phụ hiển thị',
  },
  showsubtitle: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Hiển thị phụ đề (true/false)',
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
    {
      fields: ['currentView'],
    },
    {
      fields: ['round'],
    },
    {
      fields: ['group'],
    },
    {
      fields: ['currentView', 'round'],
    },
    {
      fields: ['currentView', 'group'],
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