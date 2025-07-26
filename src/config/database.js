const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const config = require('./index');

// Khởi tạo kết nối database
const sequelize = new Sequelize(
  config.db.database,
  config.db.username,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: config.db.logging,
    define: config.db.define,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

/**
 * Kết nối đến database
 * @returns {Promise<boolean>} Kết quả kết nối
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

/**
 * Đóng kết nối database
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

// Kiểm tra kết nối khi khởi động
if (process.env.NODE_ENV !== 'test') {
  connectDB().catch(error => {
    logger.error('Database connection error:', error);
    process.exit(1);
  });
}

module.exports = {
  sequelize,
  connectDB,
  closeConnection,
  Op: Sequelize.Op,
  DataTypes: Sequelize.DataTypes
};
