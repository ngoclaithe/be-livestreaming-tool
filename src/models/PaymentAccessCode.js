const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateRandomCode } = require('../utils/helpers');

const PaymentAccessCode = sequelize.define('PaymentAccessCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    field: 'user_id',
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    comment: 'ID người tạo yêu cầu',
  },
  accessCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Mã truy cập cần kích hoạt',
  },
  code_pay: {
    type: DataTypes.STRING(6),
    allowNull: false,
    defaultValue: () => generateRandomCode(6),
    comment: 'Mã thanh toán 6 ký tự',
  },
  bankAccountNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Số tài khoản ngân hàng nhận tiền',
  },
  bankName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên ngân hàng nhận tiền',
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false,
    comment: 'Trạng thái giao dịch: chờ duyệt, thành công, hủy',
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Số tiền cần thanh toán',
  },
  transactionNote: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ghi chú giao dịch',
  },
  paymentProof: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ảnh chứng từ thanh toán',
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời gian duyệt yêu cầu',
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    comment: 'ID người duyệt yêu cầu',
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời gian hủy yêu cầu',
  },
  cancelledBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    comment: 'ID người hủy yêu cầu',
  },
  cancellationReason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Lý do hủy yêu cầu',
  },
}, {
  timestamps: true,
  tableName: 'payment_access_codes',
  underscored: true,
  paranoid: true,
  comment: 'Quản lý yêu cầu kích hoạt code thanh toán',
  indexes: [
    {
      fields: ['userId'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['accessCode'],
    },
    {
      fields: ['code_pay'],
      unique: true,
    },
    {
      fields: ['approvedBy'],
    },
    {
      fields: ['cancelledBy'],
    },
  ],
});

// Instance methods
PaymentAccessCode.prototype.approve = async function(userId) {
  if (this.status !== 'pending') {
    throw new Error('Chỉ có thể duyệt yêu cầu đang chờ xử lý');
  }
  
  this.status = 'completed';
  this.approvedAt = new Date();
  this.approvedBy = userId;
  return this.save();
};

PaymentAccessCode.prototype.cancel = async function(userId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Chỉ có thể hủy yêu cầu đang chờ xử lý');
  }
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  return this.save();
};

// Static method to generate unique payment code
PaymentAccessCode.generatePaymentCode = function() {
  return generateRandomCode(6);
};

module.exports = PaymentAccessCode;