// Use test database configuration
const { sequelize, connectDB } = require('./test/config/database');
const { Sequelize } = require('sequelize');
const logger = console; // Use console logger for tests

// Create test database if it doesn't exist
async function createTestDatabase() {
  // Connect to the default 'postgres' database first
  const tempSequelize = new Sequelize('postgres', 'postgres', 'test1234', {
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    logging: false,
  });

  try {
    // Check if the test database exists
    const result = await tempSequelize.query(
      "SELECT 1 FROM pg_database WHERE datname = 'livestream_tool_test'"
    );
    
    if (result[0].length === 0) {
      // Create the test database if it doesn't exist
      await tempSequelize.query('CREATE DATABASE livestream_tool_test');
      logger.log('✅ Test database created successfully');
    } else {
      logger.log('ℹ️ Test database already exists');
    }
  } catch (error) {
    logger.error('❌ Error creating test database:', error);
    throw error;
  } finally {
    await tempSequelize.close();
  }
}

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test authentication
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
    
    // Test model loading
    console.log('\nTesting model loading...');
    const User = require('./src/models/User');
    const Logo = require('./src/models/Logo');
    const Match = require('./src/models/Match');
    const AccessCode = require('./src/models/AccessCode');
    
    console.log('✅ All models loaded successfully.');
    
    // Test model associations
    console.log('\nTesting model associations...');
    const models = { User, Logo, Match, AccessCode };
    
    // Load all models and set up associations
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
    
    console.log('✅ Model associations set up successfully.');
    
    // Test database sync
    console.log('\nTesting database sync...');
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Database synchronized successfully.');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    if (error.original) {
      console.error('Original error:', error.original);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the test
async function runTests() {
  try {
    await createTestDatabase();
    
    // Now connect to the test database
    const { sequelize, connectDB } = require('./test/config/database');
    
    await connectDB();
    await testConnection();
    await sequelize.close();
    
    console.log('✅ All tests completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
