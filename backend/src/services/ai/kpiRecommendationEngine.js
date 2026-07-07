const { z } = require('zod');
const { buildPrompt } = require('./promptBuilder');
const { executeWithRetry } = require('./retryHandler');
const { updateKpis } = require('../../repositories/datasetRepository');

const kpiSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceColumns: z.array(z.string()),
  aggregation: z.enum(['sum', 'avg', 'count', 'ratio']),
  priority: z.enum(['primary', 'secondary'])
});

const responseSchema = z.object({
  kpis: z.array(kpiSchema)
});

const systemInstruction = `You are a business intelligence expert. Your task is to analyze a dataset and recommend up to 10 strategic Key Performance Indicators (KPIs).

The dataset overall type is: "\${datasetType}".

Here are some examples of standard KPIs for various domains to guide your prompt (the recommendations should match the actual columns present):
- Sales: Revenue, Profit, Orders, Customers
- Marketing: Spend, CTR, ROAS
- Finance: Revenue, Expenses, Cash Flow, Budget
- HR: Headcount, Attrition Rate, Avg Performance Score

Allowed KPI aggregations: "sum", "avg", "count", "ratio".
Allowed KPI priorities: "primary", "secondary".

Return ONLY a JSON object conforming exactly to this structure (do not include markdown code fences, conversational comments, or explanations):
{
  "kpis": [
    {
      "name": "KPI Name",
      "description": "Brief description of what this KPI measures and why it matters.",
      "sourceColumns": ["column_name_1", "column_name_2"],
      "aggregation": "sum",
      "priority": "primary"
    }
  ]
}`;

/**
 * Recommends a list of strategic business KPIs based on the dataset type, column roles, and sample data.
 * Applies post-filtering logic to ensure safety, removes invalid columns or columns containing PII/identifiers,
 * caps at 8 KPIs, and persists to the database.
 *
 * @param {string} datasetId - The database ID of the dataset (DataSource).
 * @param {Object} input - Analytical profiles.
 * @param {string} input.datasetType - Overall dataset business type (Phase 5).
 * @param {Array} input.columnRoles - Final column roles containing businessRole (Phase 6).
 * @param {Object} input.metadata - Dataset schema metadata (Phase 2).
 * @param {Array} [input.sampleRows] - Unmodified sample rows (up to 5).
 * @returns {Promise<Array>} The verified list of final KPIs.
 */
const recommendKpis = async (datasetId, { datasetType, columnRoles, metadata, sampleRows }) => {
  // 1. Build prompt containing metadata, columnRoles, and sampleRows
  const extraContext = {
    datasetType,
    columnRoles: (columnRoles || []).map(c => ({
      columnName: c.columnName,
      detectedType: c.detectedType,
      businessRole: c.businessRole
    }))
  };

  const prompt = buildPrompt({
    task: 'Recommend the top business KPIs based on the dataset type and available columns.',
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

  let finalKpis = [];

  if (response.success && response.data && Array.isArray(response.data.kpis)) {
    const rawKpis = response.data.kpis;
    
    // Create lookup data structures
    const validColumnNames = (columnRoles || []).map(c => c.columnName);
    const columnRoleMap = new Map();
    (columnRoles || []).forEach(c => {
      columnRoleMap.set(c.columnName, c.businessRole);
    });

    // 3. Post-AI verification filters
    const filteredKpis = rawKpis.filter(kpi => {
      // Structure check
      if (!kpi.name || !kpi.sourceColumns || !Array.isArray(kpi.sourceColumns) || kpi.sourceColumns.length === 0) {
        return false;
      }

      // Check: Cross-reference against Phase 6 actual dataset columns
      const invalidColumns = kpi.sourceColumns.filter(c => !validColumnNames.includes(c));
      if (invalidColumns.length > 0) {
        console.warn(`[kpiRecommendationEngine] Stripping KPI "${kpi.name}" because it references non-existent columns: ${invalidColumns.join(', ')}`);
        return false;
      }

      // Check: Reject any KPI referencing "identifier" or "ignore" column roles
      const hasForbiddenRole = kpi.sourceColumns.some(cName => {
        const role = columnRoleMap.get(cName);
        return role === 'identifier' || role === 'ignore';
      });

      if (hasForbiddenRole) {
        console.warn(`[kpiRecommendationEngine] Stripping KPI "${kpi.name}" because it references forbidden column roles (identifier/ignore).`);
        return false;
      }

      return true;
    });

    // 4. Cap at 8, prioritizing primary KPIs first
    const sortedKpis = [...filteredKpis].sort((a, b) => {
      if (a.priority === 'primary' && b.priority === 'secondary') return -1;
      if (a.priority === 'secondary' && b.priority === 'primary') return 1;
      return 0;
    });

    finalKpis = sortedKpis.slice(0, 8);
  } else {
    console.warn(`[kpiRecommendationEngine] AI recommendation failed. Returning empty array fallback.`);
  }

  // 5. Persist final KPIs to MongoDB
  try {
    await updateKpis(datasetId, finalKpis);
  } catch (error) {
    console.error(`[kpiRecommendationEngine] Failed to save recommended KPIs for dataset ${datasetId}:`, error);
  }

  return finalKpis;
};

module.exports = {
  recommendKpis
};
