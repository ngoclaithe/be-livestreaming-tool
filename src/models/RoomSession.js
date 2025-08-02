const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Định nghĩa model
const RoomSession = sequelize.define('RoomSession', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    accessCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        references: {
            model: 'AccessCodes',
            key: 'code'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    displayConnected: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Mảng chứa các ID của display đã kết nối'
    },
    clientConnected: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Mảng chứa các ID của client đã kết nội'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    lastActivityAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expiredAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'expired', 'pause'),
        defaultValue: 'inactive',
        allowNull: false
    }
}, {
    tableName: 'RoomSessions',
    timestamps: true,
    underscored: false
});

// Thiết lập quan hệ với AccessCode
RoomSession.associate = function(models) {
    // Sử dụng string thay vì model để tránh vòng lặp phụ thuộc
    RoomSession.belongsTo(models.AccessCode, {
        foreignKey: 'accessCode',
        targetKey: 'code',
        as: 'accessCodeInfo',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Thêm quan hệ ngược lại từ AccessCode
    models.AccessCode.hasOne(RoomSession, {
        foreignKey: 'accessCode',
        sourceKey: 'code',
        as: 'roomSession',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};

// Export model
module.exports = RoomSession;
