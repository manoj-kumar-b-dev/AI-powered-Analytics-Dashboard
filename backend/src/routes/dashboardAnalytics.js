const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dashboardAnalyticsController = require('../controllers/dashboardAnalyticsController');

const router = express.Router();

// GET /dashboard — Returns unified analytics dashboard structure
router.get('/', requireAuth, dashboardAnalyticsController.getUnifiedDashboard);

module.exports = router;
