const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Poster = sequelize.define('Poster', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  accessCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Mã truy cập để xác định phòng',
    index: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Tên của poster'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mô tả chi tiết về poster'
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Đường dẫn đến file poster trên server'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Tên gốc của file poster'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Kích thước file (bytes)'
  },
  file_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Loại file (MIME type)'
  },
  url_poster: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL của poster (cho tương thích ngược)'
  },
  uploader_ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: 'IP address of the uploader',
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Ngày tạo poster',
    field: 'createdAt'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Ngày cập nhật poster'
  }
}, {
  timestamps: true,
  tableName: 'Posters',
  indexes: [
    {
      fields: ['accessCode'],
      name: 'idx_poster_accesscode'
    },
    {
      fields: ['name'],
      name: 'idx_poster_name'
    }
  ]
});

Poster.findByAccessCode = function(accessCode) {
  return this.findOne({
    where: { accessCode }
  });
};

module.exports = Poster;