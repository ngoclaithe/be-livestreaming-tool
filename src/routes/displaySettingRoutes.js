const express = require('express');
const router = express.Router();
const displaySettingController = require('../controllers/displaySettingController');
const { protect, authorize } = require('../middleware/auth.middleware');

// Create a new display setting (requires authentication)
router.post(
  '/',
  protect,
  authorize('admin', 'user'),
  displaySettingController.createDisplaySetting
);

// Get all display settings (public endpoint - no authentication required)
router.get(
  '/',
  displaySettingController.getDisplaySettings
);

// Get display setting by ID (public endpoint - no authentication required)
router.get(
  '/:id',
  displaySettingController.getDisplaySettingById
);

// Update display setting (requires authentication)
router.put(
  '/:id',
  protect,
  authorize('admin', 'user'),
  displaySettingController.updateDisplaySetting
);

// Delete display setting (requires admin authentication)
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  displaySettingController.deleteDisplaySetting
);

// Get display settings by access code (public endpoint - no authentication required)
router.get(
  '/access-code/:accessCode',
  displaySettingController.getDisplaySettingsByAccessCode
);

module.exports = router;
