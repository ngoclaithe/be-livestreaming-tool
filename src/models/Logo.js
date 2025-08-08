const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Define Logo model
const Logo = sequelize.define('Logo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code_logo: {
    type: DataTypes.STRING(10),
    unique: {
      name: 'logos_code_logo_key',
      msg: 'Mã logo đã tồn tại'
    },
    allowNull: false,
    comment: 'Unique code for logo (Lxxxx for logo, Bxxxx for banner)',
    validate: {
      notEmpty: {
        msg: 'Mã logo không được để trống'
      },
      len: {
        args: [5, 6],
        msg: 'Mã logo phải có từ 5 đến 6 ký tự'
      }
    }
  },
  type_logo: {
    type: DataTypes.ENUM('logo', 'banner'),
    allowNull: false,
    defaultValue: 'logo',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Optional name for the logo/banner',
  },
  url_logo: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  file_path: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Local filesystem path to the uploaded file',
  },
  uploader_ip: {
    type: DataTypes.STRING(45),
    allowNull: false,
    comment: 'IP address of the uploader',
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'File size in bytes',
  },
  file_size_readable: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Human-readable file size (e.g., 1.2 MB)',
  },
  request_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of times this logo has been requested',
  },
  last_requested: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time this logo was requested',
  },
}, {
  timestamps: true,
  tableName: 'Logos',
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['code_logo'],
    },
    {
      fields: ['uploader_ip'],
    },
    {
      fields: ['type_logo'],
    },
  ],
});

Logo.generateUniqueCode = async function(type = 'logo', transaction = null) {
  const prefix = type === 'banner' ? 'B' : 'L';
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += Math.floor(Math.random() * 10);
    }
    
    const code = `${prefix}${randomPart}`; 
    
    try {
      const existingLogo = await this.findOne({
        where: { code_logo: code },
        transaction,
      });
      
      if (!existingLogo) {
        return code;
      }
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed for code generation:`, error.message);
    }
  }
  
  throw new Error(`Unable to generate unique ${type} code after ${maxAttempts} attempts`);
};

Logo.findByCode = async function(code) {
  return this.findOne({ 
    where: { code_logo: code },
    attributes: ['id', 'code_logo', 'type_logo', 'url_logo', 'createdAt']
  });
};

Logo.prototype.getPublicUrl = function() {
  if (!this.url_logo) return null;
  
  if (this.url_logo.startsWith('http')) {
    return this.url_logo;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}${this.url_logo}`;
}

/**
 * Track that this logo was requested
 * @returns {Promise<Logo>} The updated logo instance
 */
Logo.prototype.trackRequest = async function() {
  this.request_count = (this.request_count || 0) + 1;
  this.last_requested = new Date();
  return this.save();
}

/**
 * Get logo usage information
 * @returns {Object} Usage information
 */
Logo.prototype.getUsageInfo = function() {
  const { formatFileSize, getUsageLevel } = require('../utils/fileUtils');
  
  return {
    requestCount: this.request_count || 0,
    lastRequested: this.last_requested,
    fileSize: this.file_size,
    fileSizeReadable: this.file_size_readable || formatFileSize(this.file_size || 0),
    usageLevel: getUsageLevel(this.last_requested, this.createdAt, this.request_count || 0)
  };
}

Logo.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  values.public_url = this.getPublicUrl();
  
  values.usage = this.getUsageInfo();
  
  delete values.file_path;
  
  return values;
};

module.exports = Logo;