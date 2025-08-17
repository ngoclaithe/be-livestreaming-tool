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
  url_poster: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'URL của poster'
  },
  uploader_ip: {
    type: DataTypes.STRING(45),
    allowNull: false,
    comment: 'IP address of the uploader',
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Ngày tạo poster'
  }
}, {
  timestamps: true,
  tableName: 'Posters',
  indexes: [
    {
      fields: ['accessCode'],
      name: 'idx_poster_accesscode'
    }
  ]
});

Poster.findByAccessCode = function(accessCode) {
  return this.findOne({
    where: { accessCode }
  });
};

module.exports = Poster;