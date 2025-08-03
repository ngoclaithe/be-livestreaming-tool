const InfoPayment = require('../models/InfoPayment');

exports.create = async (req, res) => {
    try {
        const { name, accountNumber, bank, email, password_app } = req.body;
        if (!name || !accountNumber || !bank || !email || !password_app) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
        }

        const newInfoPayment = await InfoPayment.create({
            name,
            accountNumber,
            bank,
            email,
            password_app
        });

        res.status(201).json({
            success: true,
            data: newInfoPayment
        });
    } catch (error) {
        console.error('Lỗi khi tạo thông tin thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo thông tin thanh toán',
            error: error.message
        });
    }
};

// Lấy tất cả thông tin thanh toán
exports.getAll = async (req, res) => {
    try {
        const infoPayments = await InfoPayment.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        res.status(200).json({
            success: true,
            data: infoPayments
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách thông tin thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy danh sách thông tin thanh toán',
            error: error.message
        });
    }
};

// Lấy thông tin thanh toán theo ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const infoPayment = await InfoPayment.findByPk(id);
        
        if (!infoPayment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin thanh toán'
            });
        }
        
        res.status(200).json({
            success: true,
            data: infoPayment
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy thông tin thanh toán',
            error: error.message
        });
    }
};

// Cập nhật thông tin thanh toán
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, accountNumber, bank, email, password_app } = req.body;
        
        const infoPayment = await InfoPayment.findByPk(id);
        
        if (!infoPayment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin thanh toán để cập nhật'
            });
        }
        
        // Cập nhật các trường được cung cấp
        if (name) infoPayment.name = name;
        if (accountNumber) infoPayment.accountNumber = accountNumber;
        if (bank) infoPayment.bank = bank;
        if (email) infoPayment.email = email;
        if (password_app) infoPayment.password_app = password_app;
        
        await infoPayment.save();
        
        res.status(200).json({
            success: true,
            data: infoPayment
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật thông tin thanh toán',
            error: error.message
        });
    }
};

// Xóa thông tin thanh toán
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        
        const infoPayment = await InfoPayment.findByPk(id);
        
        if (!infoPayment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin thanh toán để xóa'
            });
        }
        
        await infoPayment.destroy();
        
        res.status(200).json({
            success: true,
            message: 'Đã xóa thông tin thanh toán thành công'
        });
    } catch (error) {
        console.error('Lỗi khi xóa thông tin thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xóa thông tin thanh toán',
            error: error.message
        });
    }
};
