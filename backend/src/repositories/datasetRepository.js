const DataSource = require('../models/dataSource');

/**
 * Updates the dataset (DataSource) document with its AI classification results.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Object} classificationResult - The classification data: { datasetType, confidence, reason }
 * @returns {Promise<Object>} The updated DataSource document.
 */
const updateClassification = async (datasetId, classificationResult) => {
  const { datasetType, confidence, reason } = classificationResult;
  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        datasetType,
        confidence,
        reason,
        classifiedAt: new Date()
      }
    },
    { new: true }
  );
};

/**
 * Updates the dataset (DataSource) document with the final merged column roles.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Array<Object>} columnRoles - The array of column roles.
 * @returns {Promise<Object>} The updated DataSource document.
 */
const updateColumnRoles = async (datasetId, columnRoles) => {
  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        columnRoles
      }
    },
    { new: true }
  );
};

/**
 * Updates the dataset (DataSource) document with the recommended KPIs.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Array<Object>} kpis - The array of KPI recommendations.
 * @returns {Promise<Object>} The updated DataSource document.
 */
const updateKpis = async (datasetId, kpis) => {
  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        kpis
      }
    },
    { new: true }
  );
};

/**
 * Updates the dataset (DataSource) document with the recommended charts.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Array<Object>} charts - The array of chart recommendations.
 * @returns {Promise<Object>} The updated DataSource document.
 */
const updateCharts = async (datasetId, charts) => {
  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        charts
      }
    },
    { new: true }
  );
};

/**
 * Saves the dashboard config to the dataset document.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Object} config - The dashboard JSON config.
 * @returns {Promise<Object>} The updated DataSource document.
 */
const saveDashboardConfig = async (datasetId, config) => {
  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        dashboardConfig: config
      }
    },
    { new: true }
  );
};

/**
 * Merges and saves generated insights to the dataset's dashboard config.
 *
 * @param {string} datasetId - The ID of the DataSource document.
 * @param {Array<Object>} insights - The array of generated insights.
 * @returns {Promise<Object>} The updated DataSource document.
 */
const updateInsights = async (datasetId, insights) => {
  const dataSource = await DataSource.findById(datasetId);
  if (!dataSource) {
    throw new Error(`DataSource not found for ID: ${datasetId}`);
  }

  const updatedConfig = {
    ...(dataSource.dashboardConfig || {}),
    insights,
    generatedAt: new Date()
  };

  return DataSource.findByIdAndUpdate(
    datasetId,
    {
      $set: {
        dashboardConfig: updatedConfig
      }
    },
    { new: true }
  );
};

module.exports = {
  updateClassification,
  updateColumnRoles,
  updateKpis,
  updateCharts,
  saveDashboardConfig,
  updateInsights
};
