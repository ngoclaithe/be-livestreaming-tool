const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateRandomCode } = require('../utils/helpers');

const PaymentAccessCode = sequelize.define('PaymentAccessCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    comment: 'ID người tạo yêu cầu',
  },
  access_code: {
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
  bank_account_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Số tài khoản ngân hàng nhận tiền',
  },
  bank_name: {
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
  transaction_note: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ghi chú giao dịch',
  },
  payment_proof: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ảnh chứng từ thanh toán',
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời gian duyệt yêu cầu',
  },
  approved_by: {
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
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời gian hủy yêu cầu',
  },
  cancelled_by: {
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
  cancellation_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Lý do hủy yêu cầu',
  },
}, {
  // Tên bảng trong database
  tableName: 'payment_access_codes',
  // Sử dụng timestamps (created_at, updated_at, deleted_at)
  timestamps: true,
  // Sử dụng soft delete (xóa mềm)
  paranoid: true,
  // Định dạng tên cột: snake_case
  underscored: true,
  comment: 'Quản lý yêu cầu kích hoạt code thanh toán',
  indexes: [
    {
      fields: ['user_id'],
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
  this.approved_at = new Date();
  this.approved_by = userId;
  return this.save();
};

PaymentAccessCode.prototype.cancel = async function(userId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Chỉ có thể hủy yêu cầu đang chờ xử lý');
  }
  
  this.status = 'cancelled';
  this.cancelled_at = new Date();
  this.cancelled_by = userId;
  this.cancellation_reason = reason;
  return this.save();
};

// Static method to generate unique payment code
PaymentAccessCode.generatePaymentCode = async function() {
  const code = generateRandomCode(6);
  const exists = await this.findOne({ where: { code_pay: code } });
  return exists ? this.generatePaymentCode() : code;
};

// Add aliases for backward compatibility if needed
PaymentAccessCode.prototype.approve = PaymentAccessCode.prototype.approve;
PaymentAccessCode.prototype.cancel = PaymentAccessCode.prototype.cancel;

module.exports = PaymentAccessCode;