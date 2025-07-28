/**
 * Main configuration file
 * Exports all configurations for the application
 */

const logger = require('./logger');

// Environment
const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';
const isProduction = env === 'production';

// JWT Configuration
const jwt = {
  secret: process.env.JWT_SECRET || 'your_jwt_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

// WebSocket Configuration
const websocket = {
  path: process.env.WS_PATH || '/socket.io',
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
  maxHttpBufferSize: parseInt(process.env.WS_MAX_HTTP_BUFFER_SIZE || '1e8', 10), // 100MB
  cors: {
    origin: true, // Cho phép tất cả origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  serveClient: false,
  cookie: false,
  // Bật CORS cho WebSocket
  allowEIO3: true,
  // Cấu hình thêm cho WebSocket
  perMessageDeflate: {
    threshold: 1024, // Kích thước ngưỡng nén (bytes)
    zlibDeflateOptions: {
      chunkSize: 16 * 1024,
    },
    zlibInflateOptions: {
      chunkSize: 16 * 1024,
    },
  }
};

// CORS Configuration - Cho phép tất cả origins
const cors = {
  origin: true, // Cho phép tất cả origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// File Upload Configuration
const fileUpload = {
  // Maximum file size (5MB)
  maxFileSize: 5 * 1024 * 1024,
  // Allowed file types
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
  // Upload directory (relative to project root)
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  // Base URL for serving uploaded files
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
};

// Rate Limit Configuration
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for OPTIONS requests
    return req.method === 'OPTIONS';
  }
};

// Database Configuration
const db = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME + (isTest ? '_test' : '') || 'livestream_tool' + (isTest ? '_test' : ''),
  dialect: process.env.DB_DIALECT || 'postgres',
  logging: env === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
};

// Redis Configuration
const redis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  enabled: process.env.REDIS_ENABLED === 'true' || false,
  ttl: 86400, // 1 day in seconds
};

module.exports = {
  // Environment
  env,
  nodeEnv: env, // Add nodeEnv alias
  isProduction,
  isTest,
  
  // Server
  port: parseInt(process.env.PORT) || 5000,
  host: process.env.HOST || '0.0.0.0',
  appUrl: process.env.APP_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 5000}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Database
  db,
  
  // Authentication & Security
  jwt,
  
  // File Upload
  fileUpload,
  
  // Caching
  redis,
  
  // API Security
  cors,
  rateLimit,
  
  // WebSocket
  websocket,
  
  // Logging
  logger,
};