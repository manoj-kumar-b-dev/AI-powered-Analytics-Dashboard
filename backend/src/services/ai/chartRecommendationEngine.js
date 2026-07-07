const { z } = require('zod');
const { buildPrompt } = require('./promptBuilder');
const { executeWithRetry } = require('./retryHandler');
const { updateCharts } = require('../../repositories/datasetRepository');

const chartSchema = z.object({
  title: z.string(),
  type: z.enum(['line', 'bar', 'pie', 'area', 'table']),
  xAxis: z.string(),
  yAxis: z.string(),
  groupBy: z.string().optional(),
  reason: z.string()
});

const responseSchema = z.object({
  charts: z.array(chartSchema)
});

const systemInstruction = `You are a data visualization and business intelligence expert. Your task is to analyze a dataset (based on its overall domain, columns, business roles, types, KPIs, and sample data) and recommend a set of 5 to 10 strategic charts.

The dataset overall type is: "\${datasetType}".

Allowed chart types: "line", "bar", "pie", "area", "table".

Guidelines for recommending charts:
- If a Date column and a numeric/metric column (or KPI) exist, recommend at least one trend-over-time chart (type "line" or "area" with Date as xAxis).
- If a low-cardinality Dimension exists, recommend a categorical breakdown (type "bar" or "pie" with the Dimension as xAxis or groupBy).
- The xAxis should represent a column name from the dataset.
- The yAxis should represent a column name or a recommended KPI.
- The groupBy should be an optional column name used for segments.

Return ONLY a JSON object conforming exactly to this structure (do not include markdown code fences, conversational comments, or explanations):
{
  "charts": [
    {
      "title": "Chart Title",
      "type": "bar",
      "xAxis": "column_name",
      "yAxis": "column_name_or_kpi",
      "groupBy": "optional_column_name",
      "reason": "Brief explanation of what this chart helps visualize."
    }
  ]
}`;

/**
 * Recommends a set of analytical charts based on the dataset type, column roles, KPIs, and sample rows.
 * Enforces strict post-AI validation filters to ensure safety, deduplicates identical recommendations,
 * selects round-robin for chart variety, caps at 10 charts, and persists results.
 *
 * @param {string} datasetId - The database ID of the dataset (DataSource).
 * @param {Object} input - Analytical profiles.
 * @param {string} input.datasetType - Overall dataset business type (Phase 5).
 * @param {Array} input.columnRoles - Final column roles containing businessRole (Phase 6).
 * @param {Array} input.kpis - Recommended KPIs (Phase 7).
 * @param {Object} input.metadata - Dataset schema metadata (Phase 2).
 * @param {Array} [input.sampleRows] - Unmodified sample rows (up to 5).
 * @returns {Promise<Array>} The verified list of final charts.
 */
const recommendCharts = async (datasetId, { datasetType, columnRoles, kpis, metadata, sampleRows }) => {
  // 1. Build prompt containing metadata, columnRoles, kpis, and sampleRows
  const extraContext = {
    datasetType,
    columnRoles: (columnRoles || []).map(c => ({
      columnName: c.columnName,
      detectedType: c.detectedType,
      businessRole: c.businessRole
    })),
    recommendedKpis: (kpis || []).map(k => ({
      name: k.name,
      sourceColumns: k.sourceColumns,
      aggregation: k.aggregation
    }))
  };

  const prompt = buildPrompt({
    task: 'Recommend the top analytical charts based on the dataset type, column roles, and recommended KPIs.',
    metadata,
    sampleRows,
    extraContext
  });

  // 2. Call the LLM retry handler
  const response = await executeWithRetry({
    prompt,
    systemInstruction: systemInstruction.replace('\${datasetType}', datasetType),
    schema: responseSchema,
    responseMimeType: 'application/json'
  });

  let finalCharts = [];

  if (response.success && response.data && Array.isArray(response.data.charts)) {
    const rawCharts = response.data.charts;

    const validColumnNames = (columnRoles || []).map(c => c.columnName);
    const validKpiNames = (kpis || []).map(k => k.name);
    const columnRoleMap = new Map();
    (columnRoles || []).forEach(c => {
      columnRoleMap.set(c.columnName, c.businessRole);
    });

    const seenCharts = new Set();
    const filteredCharts = [];

    // 3. Post-AI verification filters
    rawCharts.forEach(chart => {
      if (!chart.title || !chart.type || !chart.xAxis || !chart.yAxis) {
        return;
      }

      // Check: xAxis must exist in columns
      if (!validColumnNames.includes(chart.xAxis)) {
        console.warn(`[chartRecommendationEngine] Stripping chart "${chart.title}" because xAxis "${chart.xAxis}" is not a valid dataset column.`);
        return;
      }

      // Check: yAxis must exist in columns OR KPIs
      const yAxisIsValid = validColumnNames.includes(chart.yAxis) || validKpiNames.includes(chart.yAxis);
      if (!yAxisIsValid) {
        console.warn(`[chartRecommendationEngine] Stripping chart "${chart.title}" because yAxis "${chart.yAxis}" is not a valid column or KPI.`);
        return;
      }

      // Check: groupBy (if defined) must exist in columns
      if (chart.groupBy && !validColumnNames.includes(chart.groupBy)) {
        console.warn(`[chartRecommendationEngine] Stripping chart "${chart.title}" because groupBy "${chart.groupBy}" is not a valid dataset column.`);
        return;
      }

      // Check: Reject any chart using identifier or ignore column roles in xAxis, yAxis, or groupBy
      const columnsInChart = [chart.xAxis];
      if (validColumnNames.includes(chart.yAxis)) {
        columnsInChart.push(chart.yAxis);
      }
      if (chart.groupBy) {
        columnsInChart.push(chart.groupBy);
      }

      const hasForbiddenRole = columnsInChart.some(colName => {
        const role = columnRoleMap.get(colName);
        return role === 'identifier' || role === 'ignore';
      });

      if (hasForbiddenRole) {
        console.warn(`[chartRecommendationEngine] Stripping chart "${chart.title}" because it references forbidden column roles (identifier/ignore).`);
        return;
      }

      // Check: Deduplicate identical chart recommendations (same type + same axes)
      const chartKey = `${chart.type.toLowerCase()}|${chart.xAxis.toLowerCase()}|${chart.yAxis.toLowerCase()}`;
      if (seenCharts.has(chartKey)) {
        console.warn(`[chartRecommendationEngine] Stripping duplicate chart "${chart.title}" (${chartKey}).`);
        return;
      }
      seenCharts.add(chartKey);

      filteredCharts.push(chart);
    });

    // 4. Distribute round-robin for chart variety, capped at 10
    const chartsByType = {
      line: [],
      bar: [],
      pie: [],
      area: [],
      table: []
    };

    filteredCharts.forEach(c => {
      const typeKey = c.type.toLowerCase();
      if (chartsByType[typeKey]) {
        chartsByType[typeKey].push(c);
      }
    });

    const types = ['line', 'bar', 'pie', 'area', 'table'];
    let addedCount = 0;
    let hasMore = true;

    while (addedCount < 10 && hasMore) {
      hasMore = false;
      for (const t of types) {
        if (chartsByType[t].length > 0) {
          finalCharts.push(chartsByType[t].shift());
          addedCount++;
          hasMore = true;
          if (addedCount >= 10) break;
        }
      }
    }
  } else {
    console.warn(`[chartRecommendationEngine] AI recommendation failed. Returning empty array fallback.`);
  }

  // 5. Persist final charts to MongoDB
  try {
    await updateCharts(datasetId, finalCharts);
  } catch (error) {
    console.error(`[chartRecommendationEngine] Failed to save recommended charts for dataset ${datasetId}:`, error);
  }

  return finalCharts;
};

module.exports = {
  recommendCharts
};
