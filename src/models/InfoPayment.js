const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InfoPayment = sequelize.define('InfoPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    accountNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bank: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    password_app: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'InfoPayments',
    timestamps: true
});

module.exports = InfoPayment;
