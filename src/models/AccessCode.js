const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccessCode = sequelize.define('AccessCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired', 'revoked'),
    defaultValue: 'active',
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  matchId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Matches',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    comment: 'ID của trận đấu liên kết (nếu có)',
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  maxUses: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    comment: 'Số lần sử dụng tối đa',
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  usedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  revokedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'AccessCodes',
  indexes: [
    {
      unique: true,
      fields: ['code'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['createdBy'],
    },
    {
      fields: ['matchId'],
    },
    {
      fields: ['expiresAt'],
    },
  ],
});

// Generate a 6-character base36 access code (digits + uppercase letters)
AccessCode.generateCode = function() {
  // Generate a random number between 0 and 36^6 (2,176,782,336)
  const randomNum = Math.floor(Math.random() * Math.pow(36, 6));
  // Convert to base36 string and pad with leading zeros if needed
  return randomNum.toString(36).toUpperCase().padStart(6, '0');
};

// Check if access code is expired
AccessCode.prototype.isExpired = function() {
  return this.expiresAt && new Date() > new Date(this.expiresAt);
};

// Check if access code is active
AccessCode.prototype.isActive = function() {
  return this.status === 'active' && !this.isExpired();
};

// Mark code as used
AccessCode.prototype.markAsUsed = async function(userId) {
  this.status = 'used';
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  
  if (userId) {
    this.usedBy = userId;
  }
  
  return this.save();
};

// Revoke access code
AccessCode.prototype.revoke = async function(userId) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  
  if (userId) {
    this.revokedBy = userId;
  }
  
  return this.save();
};

// Set expiry date
AccessCode.prototype.setExpiry = async function(days) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (days || 30)); // Default to 30 days
  this.expiresAt = expiryDate;
  return this.save();
};

module.exports = AccessCode;