const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, align, json, errors, prettyPrint } = format;
const path = require('path');
const fs = require('fs');
const { env, isProduction } = require('.');

// Ensure log directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  const stackString = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${metaString}${stackString}`;
});

// Define different formats for different environments
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  align(),
  logFormat
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
  prettyPrint()
);

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'livestream-tool' },
  transports: [
    // Console transport for all environments
    new transports.Console({
      format: isProduction ? prodFormat : devFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // Error logs file
    new transports.File({
      level: 'error',
      filename: path.join(logDir, 'error.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // Combined logs file (only in production)
    isProduction && new transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  ].filter(Boolean), // Remove any falsey values (like the conditional transport)
  exitOnError: false
});

// Add stream for morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Handle uncaught exceptions and unhandled promise rejections
if (isProduction) {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // In production, you might want to restart the process here
    // process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to restart the process here
    // process.exit(1);
  });
}

module.exports = logger;
