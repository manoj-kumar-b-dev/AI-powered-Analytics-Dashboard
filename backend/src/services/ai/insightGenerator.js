const { z } = require('zod');
const { buildPrompt } = require('./promptBuilder');
const { executeWithRetry } = require('./retryHandler');
const { updateInsights } = require('../../repositories/datasetRepository');

const insightSchema = z.object({
  category: z.enum(['finding', 'warning', 'growth', 'anomaly', 'recommendation']),
  text: z.string(),
  relatedKpi: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional()
});

const responseSchema = z.object({
  insights: z.array(insightSchema)
});

const systemInstruction = `You are a professional business analytics system. Your task is to analyze aggregated KPI values and chart summary statistics and generate between 5 to 10 concise, action-oriented insights.

You must categorize each insight into exactly one of these categories:
- finding: Interesting facts or general observations about the metrics.
- warning: Areas of concern, drops in numbers, or dangerous trends.
- growth: Positive trends, growth milestones, or highlights.
- anomaly: Statistical outliers or values that deviate significantly from expectation.
- recommendation: Specific business actions to take based on the findings.

CRITICAL RULES:
- Every insight text must be self-contained and reference actual computed values (e.g. "Total revenue reached $240,000, which exceeds the benchmark") using the numbers provided in the aggregated analytics. Do NOT hallucinate or guess any numbers.
- Keep each insight text to 1-2 clear, punchy sentences.
- Reference a related KPI name in "relatedKpi" if applicable.
- Specify "severity" as "info", "warning", or "critical".

Return ONLY a JSON object conforming exactly to this structure (do not include markdown code fences, conversational comments, or explanations):
{
  "insights": [
    {
      "category": "finding",
      "text": "Revenue grew by 12% to $150,000 this month, matching the forecast.",
      "relatedKpi": "Total Revenue",
      "severity": "info"
    }
  ]
}`;

/**
 * Computes actual KPI values from the dataset rows.
 */
const computeKpis = (kpis = [], data = []) => {
  return kpis.map(kpi => {
    const colName = kpi.sourceColumns?.[0];
    if (!colName || data.length === 0) return { ...kpi, value: 0 };

    const cleanNumber = (val) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    let val = 0;
    if (kpi.aggregation === 'count') {
      val = data.length;
    } else if (kpi.aggregation === 'sum') {
      val = data.reduce((acc, row) => acc + cleanNumber(row[colName]), 0);
    } else if (kpi.aggregation === 'avg') {
      const sum = data.reduce((acc, row) => acc + cleanNumber(row[colName]), 0);
      val = sum / data.length;
    }

    return {
      name: kpi.name,
      aggregation: kpi.aggregation,
      sourceColumns: kpi.sourceColumns,
      value: val
    };
  });
};

/**
 * Computes summary statistics for charts from the dataset rows.
 */
const computeChartStats = (charts = [], data = []) => {
  return charts.map(chart => {
    const xAxis = chart.xAxis;
    const yAxis = chart.yAxis;

    const cleanNumber = (val) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    const yValues = data.map(row => cleanNumber(row[yAxis])).filter(v => !isNaN(v));
    if (yValues.length === 0) {
      return { title: chart.title, type: chart.type, xAxis, yAxis };
    }

    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const sum = yValues.reduce((acc, v) => acc + v, 0);
    const avg = sum / yValues.length;

    return {
      title: chart.title,
      type: chart.type,
      xAxis,
      yAxis,
      stats: {
        min,
        max,
        avg: Math.round(avg * 100) / 100,
        count: yValues.length
      }
    };
  });
};

/**
 * Pre-aggregates KPI and chart data, invokes Gemini to produce business insights,
 * and persists the merged results to MongoDB.
 *
 * @param {string} datasetId - The database ID of the dataset.
 * @param {Object} input - Analytical profiles.
 * @param {string} input.datasetType - Overall dataset business type (Phase 5).
 * @param {Array} input.kpis - Recommended KPIs (Phase 7).
 * @param {Array} input.charts - Recommended charts (Phase 8).
 * @param {Array} [input.sampleRows] - Unmodified sample rows (up to 5).
 * @returns {Promise<Array>} The final array of insights.
 */
const generateInsights = async (datasetId, { datasetType, kpis = [], charts = [], sampleRows = [] }) => {
  // 1. Calculate aggregated KPI values and chart summary statistics
  const computedKpis = computeKpis(kpis, sampleRows);
  const computedCharts = computeChartStats(charts, sampleRows);

  // 2. Build prompt containing ONLY aggregated statistics (no raw dataset rows)
  const extraContext = {
    datasetType,
    computedKpis,
    computedCharts
  };

  const prompt = buildPrompt({
    task: 'Generate 5 to 10 concise, self-contained business insights describing trends, warnings, anomalies, and recommendations based on the calculated stats.',
    metadata: { datasetType, rowCount: sampleRows.length },
    sampleRows: [], // do not send raw data rows, only computed stats
    extraContext
  });

  // 3. Call Gemini via retryHandler
  const response = await executeWithRetry({
    prompt,
    systemInstruction,
    schema: responseSchema,
    responseMimeType: 'application/json'
  });

  let finalInsights = [];

  if (response.success && response.data && Array.isArray(response.data.insights)) {
    finalInsights = response.data.insights;
  } else {
    console.error(`[insightGenerator] AI generation of insights failed. Using fallback empty list.`);
  }

  // 4. Save to MongoDB
  try {
    await updateInsights(datasetId, finalInsights);
  } catch (error) {
    console.error(`[insightGenerator] Failed to save insights to MongoDB for dataset ${datasetId}:`, error);
  }

  return finalInsights;
};

module.exports = {
  generateInsights,
  computeKpis,
  computeChartStats
};
