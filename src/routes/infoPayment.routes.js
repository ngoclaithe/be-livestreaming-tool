const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const infoPaymentController = require('../controllers/infoPayment.controller');

router.use(protect);

router.get('/', infoPaymentController.getAll);
router.get('/:id', infoPaymentController.getById);

router.post('/', authorize('admin'), infoPaymentController.create);
router.put('/:id', authorize('admin'), infoPaymentController.update);
router.delete('/:id', authorize('admin'), infoPaymentController.delete);

module.exports = router;
