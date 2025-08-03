const { sequelize } = require('../config/database');
const User = require('./User');
const Logo = require('./Logo');
const Match = require('./Match');
const AccessCode = require('./AccessCode');
const DisplaySetting = require('./DisplaySetting');
const RoomSession = require('./RoomSession');
const PaymentAccessCode = require('./PaymentAccessCode');

function setupAssociations() {
  try {
    // User has many Logos
    User.hasMany(Logo, { 
      foreignKey: 'userId', 
      as: 'logos',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    Logo.belongsTo(User, { 
      foreignKey: 'userId', 
      as: 'user' 
    });

    // User has many Matches
    User.hasMany(Match, { 
      foreignKey: 'createdBy', 
      as: 'matches',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    Match.belongsTo(User, { 
      foreignKey: 'createdBy', 
      as: 'creator' 
    });

    // User has many AccessCodes (multiple relationships)
    User.hasMany(AccessCode, { 
      foreignKey: 'createdBy', 
      as: 'createdAccessCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    
    User.hasMany(AccessCode, { 
      foreignKey: 'usedBy', 
      as: 'usedAccessCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    
    User.hasMany(AccessCode, { 
      foreignKey: 'revokedBy', 
      as: 'revokedAccessCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    
    // AccessCode belongs to User (multiple relationships)
    AccessCode.belongsTo(User, { 
      foreignKey: 'createdBy', 
      as: 'creator' 
    });
    
    AccessCode.belongsTo(User, { 
      foreignKey: 'usedBy', 
      as: 'user' 
    });
    
    AccessCode.belongsTo(User, { 
      foreignKey: 'revokedBy', 
      as: 'revoker' 
    });

    // Match has many AccessCodes
    Match.hasMany(AccessCode, { 
      foreignKey: 'matchId', 
      as: 'accessCodes',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    AccessCode.belongsTo(Match, { 
      foreignKey: 'matchId', 
      as: 'match' 
    });

    // AccessCode has many DisplaySettings
    AccessCode.hasMany(DisplaySetting, {
      foreignKey: 'accessCode',
      sourceKey: 'code',
      as: 'displaySettings',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    DisplaySetting.belongsTo(AccessCode, {
      foreignKey: 'accessCode',
      targetKey: 'code',
      as: 'accessCodeData'
    });

    // *** THÊM QUAN HỆ CHO ROOMSESSION ***
    // RoomSession belongs to AccessCode
    RoomSession.belongsTo(AccessCode, {
      foreignKey: 'accessCode',
      targetKey: 'code',
      as: 'accessCodeInfo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // AccessCode has one RoomSession
    AccessCode.hasOne(RoomSession, {
      foreignKey: 'accessCode',
      sourceKey: 'code',
      as: 'roomSession',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // User has many PaymentAccessCodes
    User.hasMany(PaymentAccessCode, {
      foreignKey: 'userId',
      as: 'paymentAccessCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // PaymentAccessCode belongs to User (multiple relationships)
    PaymentAccessCode.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user'
    });

    PaymentAccessCode.belongsTo(User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });

    PaymentAccessCode.belongsTo(User, {
      foreignKey: 'cancelledBy',
      as: 'canceller'
    });

    console.log('✅ Model associations set up successfully');
    return true;
  } catch (error) {
    console.error('❌ Error setting up associations:', error.message);
    return false;
  }
}

// Khởi tạo các model và quan hệ
async function initModels() {
  try {
    console.log('🔄 Setting up model associations...');
    const associationsSuccess = setupAssociations();
    
    if (!associationsSuccess) {
      throw new Error('Failed to setup model associations');
    }

    console.log('🔄 Synchronizing database...');
    
    const syncOptions = {
      alter: process.env.NODE_ENV === 'development',
      force: false, 
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    };

    await User.sync(syncOptions);
    console.log('✅ User model synced');
    
    await Logo.sync(syncOptions);
    console.log('✅ Logo model synced');
    
    await Match.sync(syncOptions);
    console.log('✅ Match model synced');
    
    await AccessCode.sync(syncOptions);
    console.log('✅ AccessCode model synced');
    
    await DisplaySetting.sync(syncOptions);
    console.log('✅ DisplaySetting model synced');
    
    await RoomSession.sync(syncOptions);
    console.log('✅ RoomSession model synced');
    
    await PaymentAccessCode.sync(syncOptions);
    console.log('✅ PaymentAccessCode model synced');

    console.log('✅ All database models synchronized successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error initializing models:', error.message);
    
    if (error.message.includes('USING') || error.message.includes('syntax error')) {
      console.log('🔄 Attempting to fix foreign key constraint issues...');
      
      try {
        if (process.env.NODE_ENV === 'development') {
          await sequelize.authenticate();
          console.log('✅ Database connection verified, skipping problematic sync');
          return true;
        }
      } catch (authError) {
        console.error('❌ Database authentication also failed:', authError.message);
      }
    }
    
    return false;
  }
}

module.exports = {
  sequelize,
  User,
  Logo,
  Match,
  AccessCode,
  DisplaySetting,
  RoomSession,
  PaymentAccessCode,
  initModels,
  setupAssociations,
};