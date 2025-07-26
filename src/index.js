require('dotenv').config();
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const swaggerUi = require('swagger-ui-express'); 

// Import configs
const { connectDB, sequelize } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/error.middleware');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

try {
  // Swagger documentation
  const { specs } = require('./config/swagger');
  
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customSiteTitle: 'Livestream Tool API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      customfavIcon: '/favicon.ico',
    })
  );

  // API documentation route
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
} catch (error) {
  logger.warn('Swagger documentation setup failed:', error.message);
}

app.use(helmet({
  crossOriginEmbedderPolicy: false, // For file uploads
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Cấu hình CORS với các tùy chọn mở rộng
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ 
  limit: '10mb', // Limit JSON payload size
  verify: (req, res, buf) => {
    req.rawBody = buf; // Store raw body for webhook validation if needed
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' // Limit URL-encoded payload size
}));
app.use(cookieParser());

if (config.nodeEnv === 'development') {
  app.use(morgan('dev', { 
    stream: { 
      write: (message) => {
        logger.info(message.trim());
      }
    },
    skip: (req, res) => {
      return req.originalUrl === '/health' || 
             req.originalUrl.startsWith('/favicon') ||
             req.originalUrl.startsWith('/static');
    }
  }));
} else {
  // Production logging with more details
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// ENHANCED: Static file serving with better caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '1d' : '0', // Cache in production
  etag: true,
  lastModified: true
}));

// Cấu hình phục vụ file tĩnh cho uploads
if (config.fileUpload && config.fileUpload.uploadDir) {
  const uploadDir = path.join(process.cwd(), config.fileUpload.uploadDir);
  
  // Đảm bảo thư mục upload tồn tại
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Thêm headers CORS cho static files
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  }, express.static(uploadDir, {
    maxAge: config.nodeEnv === 'production' ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Thêm các header bổ sung nếu cần
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));
}

// ENHANCED: Socket.IO with better error handling
const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    logger.info(`New socket connection: ${socket.id}`);
    
    // Add connection metadata
    socket.on('authenticate', (data) => {
      // Handle socket authentication here
      logger.info(`Socket ${socket.id} authenticated:`, data?.userId || 'anonymous');
    });
    
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
    
    socket.on('error', (error) => {
      logger.error(`Socket error on ${socket.id}:`, error);
    });
    
    // Add your socket event handlers here
  });

  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO connection error:', err);
  });
};

setupSocketIO(io);

// ENHANCED: Make io accessible to routes with better error handling
app.use((req, res, next) => {
  try {
    req.io = io;
    next();
  } catch (error) {
    logger.error('Error setting up socket.io in middleware:', error);
    next();
  }
});

// ENHANCED: Health check endpoint (before routes)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ENHANCED: Route imports with error handling
let authRoutes, userRoutes, logoRoutes, accessCodeRoutes;

try {
  authRoutes = require('./routes/auth.routes');
  userRoutes = require('./routes/user.routes');
  logoRoutes = require('./routes/logo.routes');
  accessCodeRoutes = require('./routes/accessCode.routes');
} catch (error) {
  logger.error('Error importing routes:', error);
  process.exit(1);
}

// DEBUG: Thêm middleware debug để kiểm tra routes
app.use((req, res, next) => {
  console.log(`🔍 [DEBUG] ${req.method} ${req.url}`);
  next();
});

// ENHANCED: API routes with consistent error handling
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/logos', logoRoutes);
app.use('/api/v1/access-codes', accessCodeRoutes);

// ENHANCED: Base route with more information
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Livestream Tool API is running',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/health',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// CRITICAL: Error handling middleware MUST be last
app.use(notFound);
app.use(errorHandler);
const startServer = async () => {
  try {
    logger.info('Starting Livestream Tool API...');
    
    // 1. Connect to database
    logger.info('Connecting to database...');
    await connectDB();
    logger.info('Database connected successfully');
    
    // 2. Initialize models and sync database - CHỈ GỌI MỘT LẦN
    logger.info('Initializing database models...');
    const { initModels } = require('./models');
    const syncSuccess = await initModels();
    
    if (!syncSuccess) {
      throw new Error('Failed to initialize database models');
    }
    logger.info('Database models initialized successfully');
    
    // 3. Initialize Redis (with fallback)
    try {
      logger.info('Initializing Redis...');
      await initializeRedis();
      logger.info('Redis initialized successfully');
    } catch (redisError) {
      logger.warn('Redis initialization failed, continuing without Redis:', redisError.message);
      // Continue without Redis - make sure your app can handle this
    }

    // 4. Start HTTP server
    const server = httpServer.listen(config.port, () => {
      logger.info(`✅ Server running in ${config.nodeEnv} mode on port ${config.port}`);
      logger.info(`📖 API Documentation: http://localhost:${config.port}/api-docs`);
      logger.info(`🏥 Health Check: http://localhost:${config.port}/health`);
    });

    // ENHANCED: Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close socket.io connections
          io.close();
          logger.info('Socket.IO connections closed');
          
          // Close database connections
          await sequelize.close();
          logger.info('Database connections closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
    
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
};

// ENHANCED: Better process error handlers
process.on('unhandledRejection', (err, promise) => {
  logger.error('🚨 Unhandled Promise Rejection:', err.message);
  logger.error('Promise:', promise);
  if (err.stack) {
    logger.error(err.stack);
  }
  
  // Close server gracefully
  httpServer.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('🚨 Uncaught Exception:', err.message);
  if (err.stack) {
    logger.error(err.stack);
  }
  process.exit(1);
});

// Start the application
startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = app;