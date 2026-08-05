const Dataset = require('../models/dataset');
const DatasetRow = require('../models/datasetRow');

/**
 * Creates a new dataset metadata entry.
 */
const createDataset = async (ownerId, fileName, rowCount, columns) => {
  const dataset = new Dataset({
    ownerId,
    fileName,
    rowCount,
    columns
  });
  return await dataset.save();
};

/**
 * Bulk inserts dataset rows associated with a dataset ID and owner ID.
 */
const insertDatasetRows = async (datasetId, ownerId, rows) => {
  const documents = rows.map(r => ({
    datasetId,
    ownerId,
    data: r
  }));

  // Batch insert in chunks of 1000 for MongoDB performance
  const batchSize = 1000;
  for (let i = 0; i < documents.length; i += batchSize) {
    const chunk = documents.slice(i, i + batchSize);
    await DatasetRow.insertMany(chunk);
  }
};

/**
 * Finds a dataset by ID owned by a specific user.
 */
const findDatasetByIdAndOwner = async (datasetId, ownerId) => {
  return await Dataset.findOne({ _id: datasetId, ownerId });
};

/**
 * Retrieves up to `limit` sample rows for a dataset owned by a specific user.
 */
const getDatasetSampleRows = async (datasetId, ownerId, limit = 10) => {
  const rows = await DatasetRow.find({ datasetId, ownerId }).limit(limit).lean();
  return rows.map(r => r.data);
};

/**
 * Retrieves all rows for a dataset owned by a specific user (for server-side execution engine).
 */
const getAllDatasetRows = async (datasetId, ownerId) => {
  const rows = await DatasetRow.find({ datasetId, ownerId }).lean();
  return rows.map(r => r.data);
};

/**
 * Lists datasets owned by a specific user.
 */
const listUserDatasets = async (ownerId) => {
  return await Dataset.find({ ownerId }).sort({ createdAt: -1 }).lean();
};

module.exports = {
  createDataset,
  insertDatasetRows,
  findDatasetByIdAndOwner,
  getDatasetSampleRows,
  getAllDatasetRows,
  listUserDatasets
};
