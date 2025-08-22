    const { DataTypes } = require('sequelize');
    const { sequelize } = require('../config/database');

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

    module.exports = RoomSession;