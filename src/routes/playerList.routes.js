const express = require('express');
const router = express.Router();
const playerListController = require('../controllers/playerList.controller');

// Tạo mới hoặc cập nhật danh sách cầu thủ
router.post(
  '/',
  playerListController.createOrUpdatePlayerList
);

// Lấy danh sách cầu thủ theo accessCode và teamType
router.get(
  '/:accessCode/team/:teamType',
  playerListController.getPlayerList
);

// Xóa danh sách cầu thủ
router.delete(
  '/:accessCode/team/:teamType',
  playerListController.deletePlayerList
);

// Lấy danh sách 10 trận gần nhất với thông tin danh sách cầu thủ
router.get('/recent/matches', playerListController.getRecentPlayerLists);

module.exports = router;