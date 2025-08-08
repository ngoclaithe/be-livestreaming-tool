const express = require('express');
const router = express.Router();
const {
  getTotalAccessCodes,
  getTotalUsers,
  getTotalPaymentRequests,
  getActiveRoomSessionsCount,
  getStatisticsSummary
} = require('../controllers/statistics.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/v1/statistics/access-codes/count
 * @desc    Get total number of access codes
 * @access  Private/Admin
 */
router.get('/access-codes/count', getTotalAccessCodes);

/**
 * @route   GET /api/v1/statistics/users/count
 * @desc    Get total number of user accounts
 * @access  Private/Admin
 */
router.get('/users/count', getTotalUsers);

/**
 * @route   GET /api/v1/statistics/payment-requests/count
 * @desc    Get total number of code purchase requests
 * @access  Private/Admin
 */
router.get('/payment-requests/count', getTotalPaymentRequests);

/**
 * @route   GET /api/v1/statistics/room-sessions/active/count
 * @desc    Get number of active room sessions
 * @access  Private/Admin
 */
router.get('/room-sessions/active/count', getActiveRoomSessionsCount);

/**
 * @route   GET /api/v1/statistics/summary
 * @desc    Get all statistics in one request
 * @access  Private/Admin
 */
router.get('/summary', getStatisticsSummary);

module.exports = router;
