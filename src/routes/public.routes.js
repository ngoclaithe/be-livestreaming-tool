const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const templateController = require('../controllers/template.controller');

// Public match routes
router.get('/matches', matchController.getMatches);
router.get('/matches/:id', matchController.getMatch);

// Public template routes
router.get('/templates', templateController.getTemplates);
router.get('/templates/:id', templateController.getTemplate);

// Public streaming routes
router.get('/streams/active', (req, res, next) => {
  req.isPublic = true;
  next();
}, require('./streaming.routes').getActiveStreams);

router.get('/streams/status/:streamId', (req, res, next) => {
  req.isPublic = true;
  next();
}, require('./streaming.routes').getStreamStatus);

module.exports = router;
