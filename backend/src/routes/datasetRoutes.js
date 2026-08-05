const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const datasetController = require('../controllers/datasetController');

const router = express.Router();

// Multer memory storage configuration with 15MB limit & file extension filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(csv|xlsx|xls)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Unsupported file type. Only .csv, .xlsx, and .xls files are allowed.'));
    }
    cb(null, true);
  }
});

// Helper wrapper for multer error handling
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds maximum allowed limit of 15MB.'
          }
        });
      }
      return res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message
        }
      });
    } else if (err) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE',
          message: err.message
        }
      });
    }
    next();
  });
};

// All dataset routes require authentication
router.use(requireAuth);

// POST /api/datasets - Upload dataset file
router.post('/', uploadMiddleware, datasetController.uploadDataset);

// GET /api/datasets - List user datasets
router.get('/', datasetController.listUserDatasets);

// GET /api/datasets/:datasetId/profile - Fetch dataset metadata & sample rows
router.get('/:datasetId/profile', datasetController.getDatasetProfile);

// POST /api/datasets/:datasetId/ask - Ask AI natural language question
router.post('/:datasetId/ask', aiRateLimiter, datasetController.askDatasetQuestion);

module.exports = router;
