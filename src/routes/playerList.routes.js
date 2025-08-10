const express = require('express');
const router = express.Router();
const playerListController = require('../controllers/playerList.controller');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');

// Tạo mới hoặc cập nhật danh sách cầu thủ
router.post(
  '/',
  [
    body('accessCode').isString().notEmpty().withMessage('Mã truy cập là bắt buộc'),
    body('teamType').isIn(['teamA', 'teamB']).withMessage('Loại đội phải là teamA hoặc teamB'),
    body('players').isArray({ min: 2, max: 11 }).withMessage('Số lượng cầu thủ phải từ 2 đến 11'),
    body('players.*.name').isString().notEmpty().withMessage('Tên cầu thủ là bắt buộc'),
    body('players.*.number')
      .optional()
      .custom(value => {
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new Error('Số áo phải là số hoặc chuỗi (ví dụ: GK)');
        }
        return true;
      })
  ],
  validate,
  playerListController.createOrUpdatePlayerList
);

// Lấy danh sách cầu thủ theo accessCode và teamType
router.get(
  '/:accessCode/team/:teamType',
  [
    param('accessCode').isString().notEmpty().withMessage('Mã truy cập là bắt buộc'),
    param('teamType').isIn(['teamA', 'teamB']).withMessage('Loại đội phải là teamA hoặc teamB')
  ],
  validate,
  playerListController.getPlayerList
);

// Xóa danh sách cầu thủ
router.delete(
  '/:accessCode/team/:teamType',
  [
    param('accessCode').isString().notEmpty().withMessage('Mã truy cập là bắt buộc'),
    param('teamType').isIn(['teamA', 'teamB']).withMessage('Loại đội phải là teamA hoặc teamB')
  ],
  validate,
  playerListController.deletePlayerList
);

// Lấy danh sách 10 trận đấu gần nhất với thông tin danh sách cầu thủ
router.get('/recent/matches', playerListController.getRecentPlayerLists);

module.exports = router;
