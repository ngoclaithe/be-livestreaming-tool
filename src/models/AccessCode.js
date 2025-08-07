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
    type: DataTypes.ENUM('active', 'used', 'expired', 'revoked', 'inactive'),
    defaultValue: 'active',
    allowNull: false,
  },
  expiredAt: {
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
      fields: ['expiredAt'],
    },
  ],
});

// Generate access code based on match type
AccessCode.generateCode = function(typeMatch = 'soccer') {
  // Define prefix based on match type
  let prefix = 'B'; // Default prefix for soccer
  
  switch(typeMatch.toLowerCase()) {
    case 'pickleball':
      prefix = 'P';
      break;
    case 'futsal':
      prefix = 'F';
      break;
    // Add more cases if needed
  }
  
  // Generate 5 random alphanumeric characters (uppercase letters and digits)
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  
  for (let i = 0; i < 5; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return prefix + randomPart;
};

// Check if access code is expired
AccessCode.prototype.isExpired = function() {
  return this.expiredAt && new Date() > new Date(this.expiredAt);
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

AccessCode.prototype.setExpiry = async function(days) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (days || 30)); 
  this.expiredAt = expiryDate;
  return this.save();
};

module.exports = AccessCode;