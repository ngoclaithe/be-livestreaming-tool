const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getActivities } = require('../controllers/activities.controller');

// Tất cả các route đều yêu cầu đăng nhập và quyền admin
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/v1/activities
 * @desc    Lấy danh sách hoạt động (tạo user, tạo access code, yêu cầu mua code)
 * @access  Private/Admin
 */
router.get('/', getActivities);

module.exports = router;
