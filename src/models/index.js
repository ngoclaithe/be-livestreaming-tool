const { sequelize } = require('../config/database');
const User = require('./User');
const Logo = require('./Logo');
const Match = require('./Match');
const AccessCode = require('./AccessCode');
const PlayerList = require('./PlayerList');
const DisplaySetting = require('./DisplaySetting');
const RoomSession = require('./RoomSession');
const PaymentAccessCode = require('./PaymentAccessCode');
const InfoPayment = require('./InfoPayment');
const Activity = require('./Activity');
const Poster = require('./Poster');
const View = require('./View');

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
      as: 'usedByUser'
    });

    AccessCode.belongsTo(User, {
      foreignKey: 'revokedBy',
      as: 'revoker'
    });

    AccessCode.hasMany(PlayerList, {
      foreignKey: 'accessCode',
      sourceKey: 'code',
      as: 'playerLists'
    });

    PlayerList.belongsTo(AccessCode, {
      foreignKey: 'accessCode',
      targetKey: 'code',
      as: 'accessCodeData'
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
      foreignKey: 'accessCodeId',
      as: 'displaySettings',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    DisplaySetting.belongsTo(AccessCode, {
      foreignKey: 'accessCodeId',
      as: 'accessCodeData'
    });

    // AccessCode has one RoomSession
    AccessCode.hasOne(RoomSession, {
      foreignKey: 'accessCodeId',
      as: 'roomSession',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    AccessCode.hasOne(View, {
      foreignKey: 'accessCodeId',
      as: 'view',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RoomSession belongs to AccessCode
    RoomSession.belongsTo(AccessCode, {
      foreignKey: 'accessCodeId',
      as: 'accessCodeInfo'
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
      as: 'owner'
    });

    PaymentAccessCode.belongsTo(User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });

    PaymentAccessCode.belongsTo(User, {
      foreignKey: 'cancelledBy',
      as: 'canceller'
    });

    // User associations for PaymentAccessCode (reverse)
    User.hasMany(PaymentAccessCode, {
      foreignKey: 'approvedBy',
      as: 'approvedPaymentCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    User.hasMany(PaymentAccessCode, {
      foreignKey: 'cancelledBy',
      as: 'cancelledPaymentCodes',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // ===== ACTIVITY MODEL ASSOCIATIONS =====
    User.hasMany(Activity, {
      foreignKey: 'userId',
      as: 'activities',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Activity belongs to User
    Activity.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user'
    });

    // AccessCode has many Posters
    AccessCode.hasMany(Poster, {
      foreignKey: 'accessCode',
      sourceKey: 'code',
      as: 'posters',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    Poster.belongsTo(AccessCode, {
      foreignKey: 'accessCode',
      targetKey: 'code',
      as: 'accessCodeData'
    });

    View.belongsTo(AccessCode, {
      foreignKey: 'accessCodeId',
      as: 'accessCode'
    });

    console.log('Model associations set up successfully');
    return true;
  } catch (error) {
    console.error('Error setting up associations:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function initModels() {
  try {
    // console.log('Initializing database models...');

    await sequelize.authenticate();
    console.log('Database connection established successfully');

    const associationsSuccess = setupAssociations();

    if (!associationsSuccess) {
      throw new Error('Failed to setup model associations');
    }

    console.log('Synchronizing database models...');

    const syncOptions = {
      alter: false,
      force: false,
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    };

    const models = [
      { model: User, name: 'User' },
      { model: Logo, name: 'Logo' },
      { model: Match, name: 'Match' },
      { model: PlayerList, name: 'PlayerList' },
      { model: AccessCode, name: 'AccessCode' },
      { model: DisplaySetting, name: 'DisplaySetting' },
      { model: RoomSession, name: 'RoomSession' },
      { model: PaymentAccessCode, name: 'PaymentAccessCode' },
      { model: InfoPayment, name: 'InfoPayment' },
      { model: Activity, name: 'Activity' },
      { model: Poster, name: 'Poster' },
      { model: View, name: 'View' },
    ];

    for (const { model, name } of models) {
      try {
        await model.sync(syncOptions);
        console.log(`${name} model synced successfully`);
      } catch (syncError) {
        console.warn(`Warning syncing ${name}:`, syncError.message);
      }
    }

    console.log('All database models initialized successfully');
    return true;

  } catch (error) {
    console.error('Error initializing models:', error.message);

    if (error.name === 'SequelizeConnectionError') {
      console.error('Database connection failed. Please check your database configuration.');
    } else if (error.message.includes('USING') || error.message.includes('syntax error')) {
      console.log('Attempting to recover from SQL syntax issues...');

      try {
        await sequelize.authenticate();
        console.log('Database connection verified, associations set up');
        return true;
      } catch (authError) {
        console.error('Database authentication failed:', authError.message);
      }
    } else if (error.name === 'SequelizeValidationError') {
      console.error('Model validation error. Please check your model definitions.');
    }

    return false;
  }
}

async function closeDatabase() {
  try {
    await sequelize.close();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  sequelize,
  User,
  Logo,
  Match,
  AccessCode,
  DisplaySetting,
  RoomSession,
  PaymentAccessCode,
  InfoPayment,
  PlayerList,
  Activity,
  Poster,
  View,
  initModels,
  setupAssociations,
  closeDatabase
};