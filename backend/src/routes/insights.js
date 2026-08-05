const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const insightController = require('../controllers/insightController');

// All routes require authentication using JWT middleware
router.use(requireAuth);

// Generate AI Insights powered by Grok API
router.post('/generate', insightController.generateInsights);

module.exports = router;
