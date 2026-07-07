/**
 * KPI Recommendation Service — LLM Powered
 *
 * Responsibilities:
 * - Send schema metadata to Gemini and receive AI-suggested KPI column mappings.
 * - Gemini analyzes column names, types, and sample values to identify which columns
 *   represent business KPIs (revenue, sales, customers, expenses, profit, etc.).
 *
 * Interface:
 * - recommendKPIs(schema: Array, domain?: string): Promise<Array>
 */

const { geminiGenerate, isGeminiAvailable } = require('../../config/gemini');

// ============================================================
// FALLBACK: Rule-based KPI mapping (used when Gemini is unavailable)
// ============================================================
const FALLBACK_KPI_SYNONYMS = {
  revenue: ['revenue', 'sales_amount', 'sales_value', 'gross_sales', 'net_sales', 'total_revenue', 'income', 'turnover', 'amount', 'total', 'sales_val'],
  sales: ['quantity', 'units_sold', 'units', 'qty', 'sales_count', 'transactions', 'volume', 'orders', 'order_count'],
  customers: ['customer_id', 'email', 'customer_name', 'client_id', 'customer', 'user_id', 'buyer', 'client'],
  expenses: ['expense', 'expenses', 'cost', 'cogs', 'spend', 'expenditure', 'outflow', 'overhead'],
  profit: ['profit', 'margin', 'net_income', 'earnings', 'net_profit', 'gross_profit'],
  date: ['date', 'created_at', 'timestamp', 'time', 'period', 'order_date', 'transaction_date', 'added', 'updated_at']
};

function fallbackRecommendKPIs(schema) {
  if (!schema || schema.length === 0) return [];
  const cols = schema.map(c => c.column);
  const recommendations = [];

  for (const [kpi, synonyms] of Object.entries(FALLBACK_KPI_SYNONYMS)) {
    for (const syn of synonyms) {
      const synNorm = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matched = cols.find(c => c.toLowerCase().replace(/[^a-z0-9]/g, '') === synNorm);
      if (matched) {
        recommendations.push({ kpi, column: matched, confidence: 0.85, source: 'fallback' });
        break;
      }
    }
  }
  return recommendations;
}

// ============================================================
// GEMINI PROMPT
// ============================================================
function buildKpiPrompt(schema, domain) {
  const schemaText = schema.map(col =>
    `- column: "${col.column}", type: "${col.type}"${col.sampleValues?.length ? `, samples: [${col.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}]` : ''}`
  ).join('\n');

  return `You are a senior data analyst AI. Analyze the following dataset schema and identify which columns best represent each business KPI.

Business Domain: "${domain}"

Dataset Schema:
${schemaText}

Your task:
- Map each relevant column to a KPI role from this list: revenue, sales, customers, expenses, profit, date
- Also suggest any domain-specific KPIs relevant to a "${domain}" dataset (e.g. for "hr": headcount, attrition, salary; for "ecommerce": aov, return_rate; for "manufacturing": production, defects, oee)
- Only map a column if you are reasonably confident it represents that KPI
- Do NOT invent columns that don't exist in the schema above
- Each column should only be mapped to ONE KPI

Respond with ONLY a valid JSON array. No explanations. Format:
[
  {
    "kpi": "<kpi_key>",
    "column": "<exact_column_name_from_schema>",
    "label": "<human readable label>",
    "format": "<currency | number | percent | date>",
    "icon": "<lucide icon name e.g. DollarSign | ShoppingCart | Users | Wallet | TrendingUp | Calendar | Percent | Activity>",
    "color": "<purple | blue | green | red | emerald | amber | indigo | orange | slate>",
    "confidence": <0.0-1.0>,
    "reason": "<1 sentence explanation>"
  }
]`;
}

class KPIRecommendationService {
  /**
   * Use Gemini LLM to recommend KPI column mappings from schema.
   * Falls back to rule-based matching if Gemini is unavailable.
   *
   * @param {Array} schema
   * @param {string} domain
   * @returns {Promise<Array>}
   */
  async recommendKPIs(schema, domain = 'general') {
    if (!schema || schema.length === 0) return [];

    // Try Gemini first
    if (isGeminiAvailable()) {
      try {
        const prompt = buildKpiPrompt(schema, domain);
        const result = await geminiGenerate(prompt);

        if (!Array.isArray(result)) {
          console.warn('[KPIRecommendation] Gemini returned non-array, falling back');
          return fallbackRecommendKPIs(schema);
        }

        // Validate that columns actually exist in schema
        const validCols = new Set(schema.map(c => c.column));
        const valid = result.filter(r =>
          r.kpi &&
          r.column &&
          validCols.has(r.column) &&
          typeof r.confidence === 'number'
        );

        if (valid.length === 0) {
          console.warn('[KPIRecommendation] Gemini returned no valid mappings, falling back');
          return fallbackRecommendKPIs(schema);
        }

        console.log(`[KPIRecommendation] Gemini suggested ${valid.length} KPI mappings for domain: ${domain}`);
        return valid;

      } catch (err) {
        console.error('[KPIRecommendation] Gemini error, falling back:', err.message);
        return fallbackRecommendKPIs(schema);
      }
    }

    // Gemini not configured — use rule-based fallback
    return fallbackRecommendKPIs(schema);
  }
}

module.exports = new KPIRecommendationService();
