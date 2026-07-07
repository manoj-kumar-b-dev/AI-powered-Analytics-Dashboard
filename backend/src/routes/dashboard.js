const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const dashboardPreferenceController = require('../controllers/dashboardPreferenceController');

const router = express.Router();

// GET /dashboards/:datasetId/preferences — Get custom layout preferences
router.get('/:datasetId/preferences', requireAuth, dashboardPreferenceController.getPreferences);

// PUT /dashboards/:datasetId/preferences — Save custom layout preferences
router.put('/:datasetId/preferences', requireAuth, dashboardPreferenceController.updatePreferences);

// POST /dashboards — Create dashboard
router.post('/', requireAuth, dashboardController.createDashboard);

// GET /dashboards — List org dashboards
router.get('/', requireAuth, dashboardController.listDashboards);

// GET /dashboards/:id — Load dashboard + resolve widget data
router.get('/:id', requireAuth, dashboardController.getDashboard);

// PATCH /dashboards/:id — Update widgets array
router.patch('/:id', requireAuth, dashboardController.patchDashboard);

// PUT /dashboards/:id — Update layout and widgets
router.put('/:id', requireAuth, dashboardController.updateDashboard);

// DELETE /dashboards/:id — Delete dashboard
router.delete('/:id', requireAuth, dashboardController.deleteDashboard);

module.exports = router;
