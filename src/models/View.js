const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const View = sequelize.define(
  'View',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    currentView: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'View hiện tại',
    },
    poster_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Loại poster',
    },
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID của template hiển thị',
    },
    url_custom_poster: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'URL của poster người dùng upload',
    },
    accessCodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'AccessCodes',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      unique: true, 
    },
  },
  {
    tableName: 'View',
    timestamps: true,
    underscored: true,
  }
);

module.exports = View;
