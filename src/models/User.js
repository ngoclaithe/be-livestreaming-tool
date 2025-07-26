const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database');
const config = require('../config');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Vui lòng nhập tên' },
        len: {
          args: [1, 50],
          msg: 'Tên không được vượt quá 50 ký tự',
        },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        msg: 'Email đã được sử dụng',
      },
      validate: {
        isEmail: {
          msg: 'Vui lòng nhập email hợp lệ',
        },
        notEmpty: {
          msg: 'Vui lòng nhập email',
        },
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Vui lòng nhập mật khẩu' },
        len: {
          args: [6, 100],
          msg: 'Mật khẩu phải có ít nhất 6 ký tự',
        },
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
      allowNull: false,
      validate: {
        isIn: {
          args: [['user', 'admin']],
          msg: 'Vai trò không hợp lệ',
        },
      },
    },
    reset_password_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_password_expire: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(255),
      defaultValue: 'default.jpg',
    },
  },
  {
    tableName: 'Users',
    timestamps: true, // Sử dụng createdAt và updatedAt tự động
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['is_active'],
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

User.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

User.prototype.getSignedJwtToken = function () {
  return jwt.sign({ id: this.id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

User.prototype.getResetPasswordToken = function () {
  const crypto = require('crypto');
  
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.reset_password_token = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.reset_password_expire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

User.findByCredentials = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  
  if (!user) {
    throw new Error('Thông tin đăng nhập không hợp lệ');
  }

  const isMatch = await user.matchPassword(password);
  
  if (!isMatch) {
    throw new Error('Thông tin đăng nhập không hợp lệ');
  }

  return user;
};

module.exports = User;