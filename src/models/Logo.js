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

// FIXED: Simplified and more reliable generateUniqueCode - Tạo mã ngắn hơn
Logo.generateUniqueCode = async function(type = 'logo', transaction = null) {
  const prefix = type === 'banner' ? 'B' : 'L';
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Tạo 4-5 ký tự random để có tổng cộng 5-6 ký tự (bao gồm prefix)
    const randomLength = Math.random() < 0.5 ? 4 : 5; // Random chọn 4 hoặc 5 ký tự
    
    let randomPart = '';
    for (let i = 0; i < randomLength; i++) {
      // Sử dụng cả số và chữ cái để tăng độ đa dạng
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const code = `${prefix}${randomPart}`;
    
    try {
      // Kiểm tra code đã tồn tại chưa
      const existingLogo = await this.findOne({
        where: { code_logo: code },
        transaction,
        // Không dùng lock trong generateUniqueCode vì có thể gây deadlock
      });
      
      if (!existingLogo) {
        return code;
      }
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed for code generation:`, error.message);
      // Tiếp tục thử với code khác
    }
  }
  
  throw new Error(`Unable to generate unique ${type} code after ${maxAttempts} attempts`);
};

// Add class method for finding by code
Logo.findByCode = async function(code) {
  return this.findOne({ 
    where: { code_logo: code },
    attributes: ['id', 'code_logo', 'type_logo', 'url_logo', 'createdAt']
  });
};

// Add instance method to get public URL
Logo.prototype.getPublicUrl = function() {
  if (!this.url_logo) return null;
  
  // If it's already a full URL, return as is
  if (this.url_logo.startsWith('http')) {
    return this.url_logo;
  }
  
  // Otherwise, construct the full URL
  const config = require('../config');
  const baseUrl = config.app?.url || `http://localhost:${config.port || 5000}`;
  return `${baseUrl}${this.url_logo.startsWith('/') ? '' : '/'}${this.url_logo}`;
};

// Add instance method to get public data
Logo.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Always include the public URL
  values.public_url = this.getPublicUrl();
  
  // Remove sensitive/internal fields
  delete values.file_path;
  // NOTE: Keep user_id for internal usage, remove only in public APIs
  
  return values;
};

module.exports = Logo;