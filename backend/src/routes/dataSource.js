const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const dataSourceController = require('../controllers/dataSourceController');

const router = express.Router();

// Multer in-memory configuration with 25MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB
  }
});

// POST /datasources/upload — Upload and Parse File
router.post('/upload', requireAuth, upload.single('file'), dataSourceController.uploadFile);

// GET /datasources — List all data sources for the active org
router.get('/', requireAuth, dataSourceController.listDataSources);

// GET /datasources/:id/preview — Fetch preview of staging/confirmed dataset
router.get('/:id/preview', requireAuth, dataSourceController.previewDataSource);

// GET /datasources/:id/all-rows — Fetch all rows of a datasource
router.get('/:id/all-rows', requireAuth, dataSourceController.allRowsDataSource);

// POST /datasources/:id/confirm — Lock in schema and mark as confirmed
router.post('/:id/confirm', requireAuth, dataSourceController.confirmDataSource);

// DELETE /datasources/:id — Remove datasource and associated raw rows
router.delete('/:id', requireAuth, dataSourceController.deleteDataSource);

module.exports = router;
