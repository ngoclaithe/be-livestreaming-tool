const express = require('express');
const router = express.Router();
const paymentAccessCodeController = require('../controllers/paymentAccessCode.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const PaymentAccessCode = require('../models/PaymentAccessCode');

const checkPaymentRequestOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const paymentRequest = await PaymentAccessCode.findByPk(id);
    
    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu thanh toán'
      });
    }
    
    if (req.user.role !== 'admin' && paymentRequest.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập yêu cầu này'
      });
    }
    
    req.paymentRequest = paymentRequest;
    next();
  } catch (error) {
    next(error);
  }
};

router.get('/code/:code_pay', paymentAccessCodeController.getPaymentRequestByCode);

router.use(protect);

router.post('/', paymentAccessCodeController.createPaymentRequest);

router.get('/', paymentAccessCodeController.getPaymentRequests);

router.get('/stats', authorize('admin'), paymentAccessCodeController.getPaymentStats);

router.get('/:id', paymentAccessCodeController.getPaymentRequest);

router.put('/:id/approve', 
  authorize('admin'),
  paymentAccessCodeController.approvePaymentRequest
);

router.put('/:id/cancel', 
  checkPaymentRequestOwnership,
  paymentAccessCodeController.cancelPaymentRequest
);

router.delete('/:id', 
  authorize('admin'),
  paymentAccessCodeController.deletePaymentRequest
);

module.exports = router;