/**
 * Chart Recommendation Service — LLM Powered
 *
 * Responsibilities:
 * - Send schema metadata and detected domain to Gemini.
 * - Gemini decides which chart types, field combinations, and aggregations best visualize the data.
 * - Returns ranked chart suggestions with confidence scores and human-readable reasons.
 *
 * Interface:
 * - recommendCharts(schema: Array, domain?: string): Promise<Array>
 */

const { geminiGenerate, isGeminiAvailable } = require('../../config/gemini');

// ============================================================
// FALLBACK: Rule-based chart suggestions (used when Gemini is unavailable)
// ============================================================
function fallbackRecommendCharts(schema) {
  if (!schema || schema.length === 0) return [];
  const suggestions = [];
  const numericCols = schema.filter(c => c.type === 'numeric').map(c => c.column);
  const dateCols = schema.filter(c => c.type === 'date').map(c => c.column);
  const categoricalCols = schema.filter(c => c.type === 'categorical' || c.type === 'boolean').map(c => c.column);

  if (dateCols.length > 0 && numericCols.length > 0) {
    suggestions.push({ chartType: 'line', xField: dateCols[0], yField: numericCols[0], aggregation: 'avg', confidence: 85, reason: 'Time-series trend chart.' });
  }
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    suggestions.push({ chartType: 'bar', xField: categoricalCols[0], yField: numericCols[0], aggregation: 'sum', confidence: 80, reason: 'Category comparison.' });
  }
  if (numericCols.length >= 2) {
    suggestions.push({ chartType: 'scatter', xField: numericCols[0], yField: numericCols[1], aggregation: 'none', confidence: 70, reason: 'Correlation analysis.' });
  }
  if (suggestions.length === 0 && schema.length > 0) {
    suggestions.push({ chartType: 'bar', xField: schema[0].column, yField: '_count', aggregation: 'count', confidence: 50, reason: 'Frequency distribution.' });
  }
  return suggestions;
}

// ============================================================
// GEMINI PROMPT
// ============================================================
function buildChartPrompt(schema, domain) {
  const schemaText = schema.map(col =>
    `- column: "${col.column}", type: "${col.type}"${col.sampleValues?.length ? `, samples: [${col.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}]` : ''}`
  ).join('\n');

  return `You are a senior data visualization AI expert. Analyze this dataset schema and suggest the best charts to display on an analytics dashboard.

Business Domain: "${domain}"

Dataset Schema:
${schemaText}

Rules:
- Suggest between 3 and 6 charts total
- Prioritize charts most relevant to the "${domain}" business domain
- chartType must be one of: "line", "bar", "pie", "scatter"
- aggregation must be one of: "sum", "avg", "count", "none"
- xField and yField must be EXACT column names from the schema above
- For count-only charts (no numeric column), set yField to "_count" and aggregation to "count"
- Do NOT repeat the same xField+yField+chartType combination
- Rank suggestions by business value (most insightful first)
- Confidence is 0-100

Respond with ONLY a valid JSON array. No markdown, no explanation:
[
  {
    "chartType": "<line|bar|pie|scatter>",
    "xField": "<exact column name>",
    "yField": "<exact column name or _count>",
    "aggregation": "<sum|avg|count|none>",
    "confidence": <0-100>,
    "reason": "<1-2 sentence explanation of why this chart is valuable for ${domain} data>"
  }
]`;
}

class ChartRecommendationService {
  /**
   * Use Gemini LLM to suggest optimal chart configurations for the dataset.
   * Falls back to rule-based logic if Gemini is unavailable.
   *
   * @param {Array} schema
   * @param {string} domain
   * @returns {Promise<Array>}
   */
  async recommendCharts(schema, domain = 'general') {
    if (!schema || schema.length === 0) return [];

    // Try Gemini first
    if (isGeminiAvailable()) {
      try {
        const prompt = buildChartPrompt(schema, domain);
        const result = await geminiGenerate(prompt);

        if (!Array.isArray(result)) {
          console.warn('[ChartRecommendation] Gemini returned non-array, falling back');
          return fallbackRecommendCharts(schema);
        }

        const validCols = new Set([...schema.map(c => c.column), '_count']);
        const VALID_CHART_TYPES = new Set(['line', 'bar', 'pie', 'scatter']);
        const VALID_AGGS = new Set(['sum', 'avg', 'count', 'none']);

        // Validate each chart suggestion
        const valid = result.filter(r =>
          VALID_CHART_TYPES.has(r.chartType) &&
          r.xField && validCols.has(r.xField) &&
          r.yField && validCols.has(r.yField) &&
          VALID_AGGS.has(r.aggregation)
        );

        // Deduplicate by xField+yField+chartType
        const seen = new Set();
        const deduped = valid.filter(r => {
          const key = `${r.chartType}-${r.xField}-${r.yField}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 6);

        if (deduped.length === 0) {
          console.warn('[ChartRecommendation] Gemini returned no valid charts, falling back');
          return fallbackRecommendCharts(schema);
        }

        console.log(`[ChartRecommendation] Gemini suggested ${deduped.length} charts for domain: ${domain}`);
        return deduped;

      } catch (err) {
        console.error('[ChartRecommendation] Gemini error, falling back:', err.message);
        return fallbackRecommendCharts(schema);
      }
    }

    // Gemini not configured — use rule-based fallback
    return fallbackRecommendCharts(schema);
  }
}

module.exports = new ChartRecommendationService();
