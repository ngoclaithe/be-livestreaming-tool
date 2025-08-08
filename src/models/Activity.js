const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Hành động (create_user, create_access_code, create_payment_request, ...)'
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Loại thực thể (user, access_code, payment_request, ...)'
  },
  entityId: {
    type: DataTypes.INTEGER,
    comment: 'ID của thực thể liên quan'
  },
  details: {
    type: DataTypes.JSONB,
    comment: 'Chi tiết bổ sung dưới dạng JSON'
  },
  ipAddress: {
    type: DataTypes.STRING,
    comment: 'Địa chỉ IP của người thực hiện'
  },
  userAgent: {
    type: DataTypes.TEXT,
    comment: 'Thông tin trình duyệt/thiết bị'
  }
}, {
  tableName: 'activities',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['action']
    },
    {
      fields: ['entity_type', 'entity_id']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = Activity;
