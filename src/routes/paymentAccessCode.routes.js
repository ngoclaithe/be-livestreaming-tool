const express = require('express');
const router = express.Router();
const { authJwt, verifySignUp } = require('../middleware');
const controller = require('../controllers/paymentAccessCode.controller');

// Middleware xác thực
const verifyToken = authJwt.verifyToken;
const isAdmin = authJwt.isAdmin;

// Tạo yêu cầu thanh toán mới
router.post(
  '/',
  [verifyToken],
  controller.createPaymentRequest
);

// Lấy danh sách yêu cầu thanh toán (admin)
router.get(
  '/admin/list',
  [verifyToken, isAdmin],
  controller.getAllPaymentRequests
);

// Lấy chi tiết yêu cầu thanh toán
router.get(
  '/:id',
  [verifyToken],
  controller.getPaymentRequestById
);

// Duyệt yêu cầu thanh toán (admin)
router.put(
  '/:id/approve',
  [verifyToken, isAdmin],
  controller.approvePaymentRequest
);

// Hủy yêu cầu thanh toán
router.put(
  '/:id/cancel',
  [verifyToken],
  controller.cancelPaymentRequest
);

// Lấy lịch sử thanh toán của người dùng
router.get(
  '/user/history',
  [verifyToken],
  controller.getUserPaymentHistory
);

module.exports = router;
