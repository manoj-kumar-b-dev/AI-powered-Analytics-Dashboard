const datasetParserService = require('../services/datasetParserService');
const datasetRepository = require('../repositories/datasetRepository');
const askAiService = require('../services/askAiService');
const { askQuestionSchema, datasetIdParamSchema } = require('../validators/datasetValidator');

/**
 * Controller for Dataset operations: Upload, Profile, and Ask AI.
 */
class DatasetController {
  /**
   * POST /api/datasets - Upload CSV or Excel file
   */
  async uploadDataset(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file was uploaded. Please attach a .csv, .xlsx, or .xls file.'
          }
        });
      }

      const { originalname, buffer } = req.file;
      const ownerId = req.user.userId;

      // Parse file & infer column types
      const parsedResult = await datasetParserService.parseFile(buffer, originalname);

      // Save dataset metadata in MongoDB
      const dataset = await datasetRepository.createDataset(
        ownerId,
        originalname,
        parsedResult.rowCount,
        parsedResult.columns
      );

      // Store parsed rows in MongoDB
      await datasetRepository.insertDatasetRows(dataset._id, ownerId, parsedResult.rows);

      return res.status(201).json({
        success: true,
        data: {
          id: dataset._id,
          fileName: dataset.fileName,
          rowCount: dataset.rowCount,
          columns: dataset.columns,
          createdAt: dataset.createdAt
        }
      });
    } catch (err) {
      if (err.message && err.message.includes('Unsupported file type')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  /**
   * GET /api/datasets/:datasetId/profile - Retrieve dataset profile & sample rows
   */
  async getDatasetProfile(req, res, next) {
    try {
      const paramResult = datasetIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid dataset ID format'
          }
        });
      }

      const { datasetId } = req.params;
      const ownerId = req.user.userId;

      const dataset = await datasetRepository.findDatasetByIdAndOwner(datasetId, ownerId);
      if (!dataset) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Dataset not found or you do not have permission to access it.'
          }
        });
      }

      const sampleRows = await datasetRepository.getDatasetSampleRows(datasetId, ownerId, 10);

      return res.status(200).json({
        success: true,
        data: {
          id: dataset._id,
          fileName: dataset.fileName,
          rowCount: dataset.rowCount,
          columns: dataset.columns,
          sampleRows,
          createdAt: dataset.createdAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/datasets/:datasetId/ask - Ask AI a natural language question about the dataset
   */
  async askDatasetQuestion(req, res, next) {
    try {
      const paramResult = datasetIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid dataset ID format'
          }
        });
      }

      const bodyResult = askQuestionSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: bodyResult.error.errors[0]?.message || 'Invalid question format'
          }
        });
      }

      const { datasetId } = req.params;
      const { question } = bodyResult.data;
      const ownerId = req.user.userId;

      const dataset = await datasetRepository.findDatasetByIdAndOwner(datasetId, ownerId);
      if (!dataset) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Dataset not found or you do not have permission to access it.'
          }
        });
      }

      const responseData = await askAiService.askQuestion(dataset, question, ownerId);

      return res.status(200).json({
        success: true,
        data: responseData
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/datasets - List user's datasets
   */
  async listUserDatasets(req, res, next) {
    try {
      const ownerId = req.user.userId;
      const datasets = await datasetRepository.listUserDatasets(ownerId);
      return res.status(200).json({
        success: true,
        data: datasets.map(d => ({
          id: d._id,
          fileName: d.fileName,
          rowCount: d.rowCount,
          columns: d.columns,
          createdAt: d.createdAt
        }))
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DatasetController();
