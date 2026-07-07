const DataSource = require('../models/dataSource');
const DataRow = require('../models/dataRow');
const { parseUploadedFile } = require('./parserService');
const AnalyticsService = require('./analyticsService');

const handleFileImport = async (user, file, body) => {
  const { buffer, originalname } = file;
  const { sheetName, action, targetDataSourceId } = body || {};

  // Parse and infer schema with optional sheetName
  const parseResult = parseUploadedFile(buffer, originalname, sheetName);
  const { rows, schema, rowCount, validation } = parseResult;

  let finalDataSourceId;
  let finalFileName = originalname;
  let finalRowCount = rowCount;
  let finalSchema = schema;
  let finalValidation = validation;

  if (action === 'replace') {
    if (!targetDataSourceId) {
      throw new Error('targetDataSourceId is required for replacement');
    }
    const target = await DataSource.findOne({ _id: targetDataSourceId, orgId: user.orgId });
    if (!target) {
      throw new Error('Target data source not found or access denied');
    }

    // Overwrite rows
    await DataRow.deleteMany({ dataSourceId: targetDataSourceId, orgId: user.orgId });

    // Update metadata
    target.fileName = originalname;
    target.schema = schema;
    target.rowCount = rowCount;
    target.validation = validation;
    target.status = 'confirmed';
    await DataSource.updateMany({ orgId: user.orgId, _id: { $ne: targetDataSourceId } }, { isActive: false });
    target.isActive = true;
    await target.save();

    finalDataSourceId = target._id;
    finalFileName = target.fileName;
    finalRowCount = target.rowCount;
    finalSchema = target.schema;
    finalValidation = target.validation;

  } else if (action === 'append') {
    if (!targetDataSourceId) {
      throw new Error('targetDataSourceId is required for appending');
    }
    const target = await DataSource.findOne({ _id: targetDataSourceId, orgId: user.orgId });
    if (!target) {
      throw new Error('Target data source not found or access denied');
    }

    // Update metadata
    target.rowCount += rowCount;
    const targetVal = target.validation || { problemCount: 0, problemSamples: [] };
    const sourceVal = validation || { problemCount: 0, problemSamples: [] };
    target.validation = {
      problemCount: (targetVal.problemCount || 0) + (sourceVal.problemCount || 0),
      problemSamples: [...(targetVal.problemSamples || []), ...(sourceVal.problemSamples || [])].slice(0, 10)
    };
    target.status = 'confirmed';
    await DataSource.updateMany({ orgId: user.orgId, _id: { $ne: targetDataSourceId } }, { isActive: false });
    target.isActive = true;
    await target.save();

    finalDataSourceId = target._id;
    finalFileName = target.fileName;
    finalRowCount = target.rowCount;
    finalSchema = target.schema;
    finalValidation = target.validation;

  } else {
    // Normal confirm or legacy staging preview
    const targetStatus = action === 'confirm' ? 'confirmed' : 'preview';
    await DataSource.updateMany({ orgId: user.orgId }, { isActive: false });
    const dataSource = new DataSource({
      orgId: user.orgId,
      uploadedBy: user.userId,
      fileName: originalname,
      schema,
      rowCount,
      validation,
      status: targetStatus,
      isActive: true
    });

    await dataSource.save();
    finalDataSourceId = dataSource._id;
    finalFileName = dataSource.fileName;
    finalRowCount = dataSource.rowCount;
    finalSchema = dataSource.schema;
    finalValidation = dataSource.validation;
  }

  // Batch insert DataRow documents under finalDataSourceId
  const dataRowDocs = rows.map(row => ({
    orgId: user.orgId,
    dataSourceId: finalDataSourceId,
    data: row
  }));

  // Chunked insertion to prevent heap memory blowout
  const chunkSize = 5000;
  for (let i = 0; i < dataRowDocs.length; i += chunkSize) {
    const chunk = dataRowDocs.slice(i, i + chunkSize);
    await DataRow.insertMany(chunk);
  }

  // Precompute baseline analytics
  await AnalyticsService.persistAnalytics(finalDataSourceId, user.orgId);

  return {
    dataSourceId: finalDataSourceId,
    fileName: finalFileName,
    rowCount: finalRowCount,
    schema: finalSchema,
    validation: finalValidation
  };
};

module.exports = {
  handleFileImport
};
