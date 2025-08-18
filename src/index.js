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

const { connectDB, sequelize } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (
  process.env.CORS_ORIGINS || 
  'http://localhost:3000,https://scoliv2.vercel.app,https://scoliv2.com,https://*.builder.my,https://builder.my'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  optionsSuccessStatus: 204
}));

app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Socket.IO not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  maxHttpBufferSize: 1e8, 
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { chunkSize: 16 * 1024 },
    zlibInflateOptions: { chunkSize: 16 * 1024 },
  }
});

try {
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

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
} catch (error) {
  logger.warn('Swagger documentation setup failed:', error.message);
}

app.use(helmet({
  crossOriginEmbedderPolicy: false, 
  crossOriginResourcePolicy: false, 
  contentSecurityPolicy: false,
}));

app.use(express.json({ 
  limit: '10mb', 
  verify: (req, res, buf) => {
    req.rawBody = buf; 
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
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
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

const WebSocketService = require('./services/websocket.service');
const webSocketService = new WebSocketService(io);
webSocketService.initialize();

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

if (config.fileUpload && config.fileUpload.uploadDir) {
  const uploadDir = path.join(process.cwd(), config.fileUpload.uploadDir);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (config.fileUpload && config.fileUpload.uploadDir) {
    const uploadDir = path.join(process.cwd(), config.fileUpload.uploadDir);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    app.use('/api/v1/uploads', express.static(uploadDir, {
      maxAge: config.nodeEnv === 'production' ? '7d' : '0',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
    }));
  }
}

io.engine.on('connection_error', (err) => {
  logger.error('Socket.IO connection error:', err);
});

app.use((req, res, next) => {
  try {
    req.io = io;
    req.app.set('webSocketService', webSocketService);
    next();
  } catch (error) {
    logger.error('Error setting up socket.io in middleware:', error);
    next();
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

let authRoutes, userRoutes, logoRoutes, accessCodeRoutes, displaySettingRoutes, roomSessionRoutes, paymentAccessCodeRoutes, infoPaymentRoutes, activitiesRoutes, statisticsRoutes, socketRoutes, posterRoutes;

try {
  authRoutes = require('./routes/auth.routes');
  userRoutes = require('./routes/user.routes');
  logoRoutes = require('./routes/logo.routes');
  accessCodeRoutes = require('./routes/accessCode.routes');
  displaySettingRoutes = require('./routes/displaySettingRoutes');
  roomSessionRoutes = require('./routes/roomSessionRoutes');
  paymentAccessCodeRoutes = require('./routes/paymentAccessCode.routes');
  infoPaymentRoutes = require('./routes/infoPayment.routes');
  activitiesRoutes = require('./routes/activities.routes');
  statisticsRoutes = require('./routes/statistics.routes');
  playerListRoutes = require('./routes/playerList.routes');
  socketRoutes = require('./routes/socket.routes');
  posterRoutes = require('./routes/poster.routes');
} catch (error) {
  logger.error('Error importing routes:', error);
  process.exit(1);
}

app.use((req, res, next) => {
  console.log(`🔍 [DEBUG] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/logos', logoRoutes);
app.use('/api/v1/access-codes', accessCodeRoutes);
app.use('/api/v1/display-settings', displaySettingRoutes);
app.use('/api/v1/room-sessions', roomSessionRoutes);
app.use('/api/v1/payment-access-codes', paymentAccessCodeRoutes);
app.use('/api/v1/info-payments', infoPaymentRoutes);
app.use('/api/v1/statistics', statisticsRoutes);
app.use('/api/v1/activities', activitiesRoutes);
app.use('/api/v1/player-lists', playerListRoutes);
app.use('/api/v1/sockets', socketRoutes);
app.use('/api/v1/posters', posterRoutes);

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

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    logger.info('Starting Livestream Tool API...');
    
    logger.info('Connecting to database...');
    await connectDB();
    logger.info('Database connected successfully');
    
    logger.info('Initializing database models...');
    const { initModels } = require('./models');
    const syncSuccess = await initModels();
    
    if (!syncSuccess) {
      throw new Error('Failed to initialize database models');
    }
    logger.info('Database models initialized successfully');
    
    try {
      logger.info('Initializing Redis...');
      await initializeRedis();
      logger.info('Redis initialized successfully');
    } catch (redisError) {
      logger.warn('Redis initialization failed, continuing without Redis:', redisError.message);
    }

    const server = httpServer.listen(config.port, config.host, () => {
      logger.info(`📖 API Documentation: http://${config.host}:${config.port}/api-docs`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          io.close();
          logger.info('Socket.IO connections closed');
          
          await sequelize.close();
          logger.info('Database connections closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
      
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

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

process.on('unhandledRejection', (err, promise) => {
  logger.error('🚨 Unhandled Promise Rejection:', err.message);
  logger.error('Promise:', promise);
  if (err.stack) {
    logger.error(err.stack);
  }
  
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

startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = app;
