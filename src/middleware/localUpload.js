const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const config = require('../config');
const logger = require('../utils/logger');

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), config.fileUpload.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = config.fileUpload.allowedFileTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        `Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`,
        StatusCodes.BAD_REQUEST
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.fileUpload.maxFileSize,
  },
  fileFilter: fileFilter,
});

// Middleware to handle single file upload
const uploadSingle = (fieldName) => (req, res, next) => {
  const uploadSingleFile = upload.single(fieldName);
  
  // Log upload attempt
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`📤 [Upload] New upload attempt from IP: ${clientIp}`);
  
  // Handle the file upload
  uploadSingleFile(req, res, function (err) {
    if (err) {
      logger.error(`❌ [Upload Error] ${err.message}`, { 
        ip: clientIp,
        error: err 
      });
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(
            `File quá lớn. Kích thước tối đa là ${config.fileUpload.maxFileSize / 1024 / 1024}MB`,
            StatusCodes.BAD_REQUEST
          )
        );
      }
      return next(err);
    }
    
    if (req.file) {
      const relativePath = path.relative(process.cwd(), req.file.path);
      const relativeUrl = `/${relativePath.replace(/\\/g, '/')}`;
      req.file.fileUrl = relativeUrl;
      
      logger.info(`✅ [Upload Success] File uploaded successfully`, { 
        ip: clientIp,
        file: req.file.filename,
        size: req.file.size,
        url: relativeUrl
      });
    }
    
    next();
  });
};

// Middleware to handle multiple file uploads
const uploadMultiple = (fieldName, maxCount = 5) => (req, res, next) => {
  const uploadMultipleFiles = upload.array(fieldName, maxCount);
  
  uploadMultipleFiles(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(
            `One or more files are too large. Max size is ${config.fileUpload.maxFileSize / 1024 / 1024}MB`,
            StatusCodes.BAD_REQUEST
          )
        );
      }
      return next(err);
    }
    
    // If files were uploaded, add file paths to the request
    if (req.files && req.files.length > 0) {
      req.files = req.files.map(file => {
        const relativePath = path.relative(process.cwd(), file.path);
        return {
          ...file,
          fileUrl: `${config.fileUpload.baseUrl}/${relativePath.replace(/\\/g, '/')}`
        };
      });
    }
    
    next();
  });
};

// Middleware to handle file deletion
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      return resolve();
    }
    
    // Convert URL to filesystem path if necessary
    let fsPath = filePath;
    if (filePath.startsWith(config.fileUpload.baseUrl)) {
      const relativePath = filePath.replace(config.fileUpload.baseUrl, '').replace(/^\//, '');
      fsPath = path.join(process.cwd(), relativePath);
    }
    
    // Check if file exists
    if (!fs.existsSync(fsPath)) {
      logger.warn(`File not found for deletion: ${fsPath}`);
      return resolve();
    }
    
    // Delete the file
    fs.unlink(fsPath, (err) => {
      if (err) {
        logger.error(`Error deleting file ${fsPath}:`, err);
        return reject(err);
      }
      logger.info(`Successfully deleted file: ${fsPath}`);
      resolve();
    });
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteFile,
};
