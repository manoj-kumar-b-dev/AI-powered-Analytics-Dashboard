/**
 * Insight Generator Service — LLM Powered
 *
 * Responsibilities:
 * - Send computed KPI data, domain context, and rule engine alerts to Gemini.
 * - Gemini generates rich, domain-aware, natural language insights.
 * - Each insight has a type (sparkle/trending/warning/lightbulb) and severity level.
 *
 * Interface:
 * - generateInsights(kpiSummary: Array, anomalyList: Array, domain?: string, domainLabel?: string): Promise<Array>
 */

const { geminiGenerate, isGeminiAvailable } = require('../../config/gemini');

// ============================================================
// FALLBACK: Rule-based insights (when Gemini is unavailable)
// ============================================================
function fallbackGenerateInsights(kpiSummary, anomalyList) {
  const insights = [];
  const kpiMap = {};
  (kpiSummary || []).forEach(k => { kpiMap[k.kpi] = k; });

  if (kpiMap.growth) {
    const isPositive = kpiMap.growth.value >= 0;
    insights.push({
      id: 'ins-growth',
      text: `Overall growth trend is <span class='${isPositive ? "text-green-400" : "text-rose-400"} font-semibold'>${kpiMap.growth.formattedValue}</span> compared to the prior period.`,
      type: isPositive ? 'sparkle' : 'warning',
      severity: isPositive ? 'success' : 'warning'
    });
  }
  if (kpiMap.revenue) {
    insights.push({
      id: 'ins-revenue',
      text: `Total revenue is <span class='text-green-400 font-semibold'>${kpiMap.revenue.formattedValue}</span> across the active period.`,
      type: 'sparkle',
      severity: 'success'
    });
  }
  if (kpiMap.profit) {
    insights.push({
      id: 'ins-profit',
      text: `Net profit stands at <span class='text-indigo-400 font-semibold'>${kpiMap.profit.formattedValue}</span>.`,
      type: 'trending',
      severity: 'info'
    });
  }
  if (anomalyList.length > 0) {
    insights.push({
      id: 'ins-anomalies',
      text: `Rule engine detected <span class='text-rose-400 font-semibold'>${anomalyList.length} operational alerts</span> or anomalies.`,
      type: 'warning',
      severity: 'warning'
    });
  } else {
    insights.push({
      id: 'ins-clean',
      text: `All baseline validation checks passed. Data trends look stable.`,
      type: 'lightbulb',
      severity: 'success'
    });
  }
  return insights;
}

// ============================================================
// GEMINI PROMPT
// ============================================================
function buildInsightPrompt(kpiSummary, anomalyList, domain, domainLabel) {
  const kpiText = (kpiSummary || []).map(k =>
    `- ${k.label || k.kpi}: ${k.formattedValue}${k.deltaPct !== null && k.deltaPct !== undefined ? ` (${k.deltaDirection === 'up' ? '+' : ''}${k.deltaPct}% vs prior period)` : ''}`
  ).join('\n');

  const alertText = anomalyList.length > 0
    ? anomalyList.map(a => `- ALERT: "${a.label}" — triggered in ${a.triggeredCount} rows (severity: ${a.severity})`).join('\n')
    : '- No rule violations detected';

  return `You are a senior business intelligence AI analyst specializing in ${domainLabel} analytics.

Domain: "${domain}" (${domainLabel})

Computed KPI Metrics:
${kpiText || '- No KPI data available'}

Rule Engine Alerts:
${alertText}

Your task:
Generate 4 to 6 professional, actionable business insights based on the KPI data and alerts above.
Each insight must:
1. Be specific to the "${domain}" domain context
2. Reference actual numbers from the KPIs above
3. Include an actionable recommendation where appropriate
4. Be written in a clear, concise business style (1-2 sentences max)
5. Use HTML span tags for highlighting key values: <span class='text-emerald-400 font-semibold'>value</span> for positive, <span class='text-rose-400 font-semibold'>value</span> for negative, <span class='text-indigo-400 font-semibold'>value</span> for neutral

type must be one of: "sparkle" (positive/success), "trending" (neutral/informational), "warning" (alert/negative), "lightbulb" (tip/recommendation)
severity must be one of: "success", "info", "warning", "critical"

Respond with ONLY a valid JSON array. No markdown. No extra text:
[
  {
    "id": "ins-<unique-short-key>",
    "text": "<insight text with HTML spans>",
    "type": "<sparkle|trending|warning|lightbulb>",
    "severity": "<success|info|warning|critical>"
  }
]`;
}

class InsightGeneratorService {
  /**
   * Use Gemini LLM to generate domain-aware business insights.
   * Falls back to rule-based insights if Gemini is unavailable.
   *
   * @param {Array} kpiSummary - Computed KPI cards from analyticsService.calculateKPIs()
   * @param {Array} anomalyList - Rule engine alerts
   * @param {string} domain - Detected dataset domain
   * @param {string} domainLabel - Human-readable domain label
   * @returns {Promise<Array>}
   */
  async generateInsights(kpiSummary, anomalyList = [], domain = 'general', domainLabel = 'General') {
    // Try Gemini first
    if (isGeminiAvailable()) {
      try {
        const prompt = buildInsightPrompt(kpiSummary, anomalyList, domain, domainLabel);
        const result = await geminiGenerate(prompt);

        if (!Array.isArray(result)) {
          console.warn('[InsightGenerator] Gemini returned non-array, falling back');
          return fallbackGenerateInsights(kpiSummary, anomalyList);
        }

        const VALID_TYPES = new Set(['sparkle', 'trending', 'warning', 'lightbulb']);
        const VALID_SEVERITIES = new Set(['success', 'info', 'warning', 'critical']);

        const valid = result.filter(r =>
          r.id && typeof r.text === 'string' && r.text.length > 0 &&
          VALID_TYPES.has(r.type) &&
          VALID_SEVERITIES.has(r.severity)
        ).slice(0, 8);

        if (valid.length === 0) {
          console.warn('[InsightGenerator] Gemini returned no valid insights, falling back');
          return fallbackGenerateInsights(kpiSummary, anomalyList);
        }

        console.log(`[InsightGenerator] Gemini generated ${valid.length} insights for domain: ${domain}`);
        return valid;

      } catch (err) {
        console.error('[InsightGenerator] Gemini error, falling back:', err.message);
        return fallbackGenerateInsights(kpiSummary, anomalyList);
      }
    }

    // Gemini not configured — use rule-based fallback
    return fallbackGenerateInsights(kpiSummary, anomalyList);
  }
}

module.exports = new InsightGeneratorService();
