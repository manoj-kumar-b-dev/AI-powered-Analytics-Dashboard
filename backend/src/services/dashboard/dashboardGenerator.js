const { saveDashboardConfig } = require('../../repositories/datasetRepository');

/**
 * Generates a structured dynamic dashboard layout configuration and saves it to MongoDB.
 *
 * @param {string} datasetId - The ID of the dataset.
 * @param {Object} input - Analytical profiles.
 * @param {Array} input.kpis - Recommended KPIs (Phase 7).
 * @param {Array} input.charts - Recommended charts (Phase 8).
 * @param {string} input.datasetType - Categorized dataset type (Phase 5).
 * @param {Array} [input.insights] - Insights placeholder array (Phase 10).
 * @returns {Promise<Object>} The generated dashboard configuration JSON.
 */
const generateDashboardConfig = async (datasetId, { kpis = [], charts = [], datasetType, insights = [] }) => {
  const layout = [];

  // 1. Position KPIs: 4 KPI cards per row (width: 3, height: 2) on a 12-column grid
  kpis.forEach((kpi, index) => {
    const w = 3;
    const h = 2;
    const columnsPerRow = 4;
    const x = (index % columnsPerRow) * w;
    const y = Math.floor(index / columnsPerRow) * h;

    layout.push({
      widgetId: `kpi-${index}`,
      type: 'kpi',
      refId: kpi.name,
      gridPosition: { x, y, w, h }
    });
  });

  // 2. Position Charts: 2 charts per row (width: 6, height: 4) starting below the KPI grid rows
  const kpiRowCount = Math.ceil(kpis.length / 4);
  const chartStartY = kpiRowCount * 2;

  charts.forEach((chart, index) => {
    const w = 6;
    const h = 4;
    const columnsPerRow = 2;
    const x = (index % columnsPerRow) * w;
    const y = chartStartY + Math.floor(index / columnsPerRow) * h;

    layout.push({
      widgetId: `chart-${index}`,
      type: 'chart',
      refId: chart.title,
      gridPosition: { x, y, w, h }
    });
  });

  const config = {
    datasetId,
    datasetType,
    layout,
    kpis,
    charts,
    insights,
    generatedAt: new Date()
  };

  // 3. Persist layout configuration to dataset record in MongoDB
  await saveDashboardConfig(datasetId, config);

  return config;
};

module.exports = {
  generateDashboardConfig
};
