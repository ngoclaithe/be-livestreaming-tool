const cors = require('cors');
const config = require('../config');

// Cấu hình CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép tất cả các nguồn trong môi trường phát triển
    if (config.nodeEnv === 'development') {
      console.log(`[CORS] Allowing request from origin: ${origin || 'unknown'}`);
      return callback(null, true);
    }

    // Trong môi trường production, kiểm tra nguồn gốc
    const allowedOrigins = [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
      'http://localhost:3000',
    ];

    // Thêm các domain được phép từ biến môi trường nếu có
    if (config.cors?.allowedOrigins) {
      allowedOrigins.push(...config.cors.allowedOrigins.split(','));
    }

    // Kiểm tra nguồn gốc
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Cho phép gửi cookie qua CORS
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Access-Token',
    'Content-Disposition', // Cần thiết cho việc tải file
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range',
    'Content-Disposition', // Cần thiết cho việc tải file
  ],
  maxAge: 600, // Thời gian cache preflight request (giây)
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware CORS
const corsMiddleware = cors(corsOptions);

// Middleware xử lý preflight request
const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
    res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
    res.header('Access-Control-Max-Age', corsOptions.maxAge);
    return res.status(204).end();
  }
  next();
};

module.exports = {
  cors: corsMiddleware,
  handlePreflight,
};

// Sử dụng trong ứng dụng:
// app.use(corsMiddleware);
// app.use(handlePreflight);
