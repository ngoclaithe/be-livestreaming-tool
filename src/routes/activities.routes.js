const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getActivities } = require('../controllers/activities.controller');

// Yêu cầu đăng nhập nhưng không yêu cầu quyền admin
router.use(protect);

/**
 * @route   GET /api/v1/activities
 * @desc    Lấy danh sách hoạt động (tạo access code, yêu cầu mua code, thay đổi trạng thái)
 * @access  Private
 */
router.get('/', getActivities);

module.exports = router;
