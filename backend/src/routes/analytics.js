const express = require('express');
const { requireAuth } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

// GET /datasources/:id/suggest-charts — Suggest charts based on schema
router.get('/:id/suggest-charts', requireAuth, analyticsController.suggestCharts);

// GET /datasources/:id/chart-data — Fetch aggregated chart series data
router.get('/:id/chart-data', requireAuth, analyticsController.chartData);

// POST /datasources/:id/kpi-mapping — Override manual column assignments for KPIs
router.post('/:id/kpi-mapping', requireAuth, analyticsController.updateKpiMapping);

// GET /datasources/:id/kpis — Compute KPI stats server-side
router.get('/:id/kpis', requireAuth, analyticsController.getKpis);

module.exports = router;
