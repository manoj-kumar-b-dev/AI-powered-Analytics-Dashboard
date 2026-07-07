const DataSource = require('../models/dataSource');
const DataRow = require('../models/dataRow');
const { handleFileImport } = require('../services/dataSourceService');
const AnalyticsService = require('../services/analyticsService');

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'No file was uploaded'
        }
      });
    }

    const { action } = req.body || {};

    const importResult = await handleFileImport(req.user, req.file, req.body);

    return res.status(201).json({
      message: action === 'replace' ? 'Dataset replaced successfully' : action === 'append' ? 'Dataset appended successfully' : action === 'confirm' ? 'Dataset imported successfully' : 'File parsed and staged for preview successfully',
      ...importResult
    });
  } catch (err) {
    console.error('File Upload Error:', err);
    return res.status(err.message && err.message.includes('not found') ? 404 : 400).json({
      error: {
        code: 'BAD_REQUEST',
        message: err.message || 'Something went wrong during file upload and processing'
      }
    });
  }
};

exports.listDataSources = async (req, res) => {
  try {
    const dataSources = await DataSource.find({ orgId: req.user.orgId }).sort({ createdAt: -1 });
    return res.status(200).json(dataSources);
  } catch (err) {
    console.error('List DataSources Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch data sources'
      }
    });
  }
};

exports.previewDataSource = async (req, res) => {
  try {
    const { id } = req.params;

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    });
    
    if (!dataSource) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Data source not found or access denied'
        }
      });
    }

    const rows = await DataRow.find({ 
      dataSourceId: id,
      orgId: req.user.orgId 
    }).limit(50);

    const dsObj = dataSource.toObject();
    return res.status(200).json({
      dataSource: {
        _id: dsObj._id,
        fileName: dsObj.fileName,
        schema: dsObj.schema,
        rowCount: dsObj.rowCount,
        status: dsObj.status,
        validation: dsObj.validation,
        kpiMapping: dsObj.kpiMapping || {}
      },
      previewRows: rows.map(r => r.data)
    });
  } catch (err) {
    console.error('Fetch Preview Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dataset preview'
      }
    });
  }
};

exports.allRowsDataSource = async (req, res) => {
  try {
    const { id } = req.params;
    const dataSource = await DataSource.findOne({ _id: id, orgId: req.user.orgId });
    if (!dataSource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data source not found or access denied' } });
    }
    const rows = await DataRow.find({ dataSourceId: id, orgId: req.user.orgId }).select('data -_id');
    return res.status(200).json(rows.map(r => r.data));
  } catch (err) {
    console.error('Fetch All Rows Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch all rows' } });
  }
};

exports.confirmDataSource = async (req, res) => {
  try {
    const { id } = req.params;

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    });
    
    if (!dataSource) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Data source not found'
        }
      });
    }

    dataSource.status = 'confirmed';
    await DataSource.updateMany({ orgId: req.user.orgId, _id: { $ne: id } }, { isActive: false });
    dataSource.isActive = true;
    await dataSource.save();

    // Precompute baseline analytics
    await AnalyticsService.persistAnalytics(id, req.user.orgId);

    return res.status(200).json({
      message: 'Data source confirmed successfully',
      dataSource: dataSource.toObject()
    });
  } catch (err) {
    console.error('Confirm DataSource Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm data source'
      }
    });
  }
};

exports.deleteDataSource = async (req, res) => {
  try {
    const { id } = req.params;

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    });
    
    if (!dataSource) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Data source not found'
        }
      });
    }

    await DataRow.deleteMany({ 
      dataSourceId: id,
      orgId: req.user.orgId
    });
    await DataSource.deleteOne({
      _id: id,
      orgId: req.user.orgId
    });

    return res.status(200).json({
      message: 'Data source and corresponding rows deleted successfully'
    });
  } catch (err) {
    console.error('Delete DataSource Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete data source'
      }
    });
  }
};
