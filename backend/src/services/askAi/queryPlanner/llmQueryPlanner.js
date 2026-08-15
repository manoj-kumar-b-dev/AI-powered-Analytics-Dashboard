const llmService = require('../../llmService');
const { createQueryPlan } = require('../queryPlanSchema');

/**
 * LLMQueryPlanner
 *
 * Prompts the multi-provider LLM service to analyze user questions,
 * dataset semantic context, analytical context, and conversation history,
 * returning a structured, zero-math Version 1.0 Query Plan.
 */
class LLMQueryPlanner {
  /**
   * Generates a structured Query Plan via LLM.
   * @param {string} question - Current user question
   * @param {Object} semanticContext - Dataset semantic profile
   * @param {Object} analyticalContext - Available analytics
   * @param {Object} conversationContext - Recent chat turns
   * @returns {Promise<Object>} Query Plan object
   */
  async plan(question, semanticContext, analyticalContext, conversationContext) {
    if (!llmService.isAvailable()) {
      throw new Error('LLM Service unavailable for query planning');
    }

    const systemPrompt = `You are a Principal Analytics Architect & Query Planner.
Your task is to convert the user's natural language question about a tabular dataset into a structured Query Plan JSON object.

RULES:
1. You MUST NOT compute numerical math results yourself.
2. Refer strictly to the dataset columns and semantic roles provided.
3. Use the conversation history to resolve follow-up references (e.g., "Which one grew fastest?", "What about last month?").
4. Output MUST be valid JSON only matching this schema:

{
  "schemaVersion": "1.0",
  "intent": "overall_summary" | "group_by" | "top_n" | "bottom_n" | "ranking" | "compare_periods" | "trend" | "filter_and_aggregate",
  "metric": {
    "column": "exact_column_name_or_null",
    "aggregation": "sum" | "avg" | "min" | "max" | "count" | "count_distinct"
  },
  "dimension": {
    "column": "exact_column_name_or_null"
  },
  "temporal": {
    "column": "exact_date_column_name_or_null",
    "filter": "YYYY-MM or YYYY or null",
    "periodType": "monthly" | "quarterly" | "yearly"
  },
  "filter": {
    "column": "column_name_or_null",
    "value": "filter_value_or_null"
  },
  "sort": {
    "direction": "desc" | "asc"
  },
  "limit": 5,
  "visualization": {
    "type": "bar" | "line" | "pie" | "table" | "none"
  },
  "confidence": 0.95,
  "ambiguousOptions": null
}

DATASET SEMANTIC CONTEXT:
${JSON.stringify(semanticContext.columns.map(c => ({
  name: c.name,
  role: c.semanticRole,
  type: c.physicalType,
  aliases: c.aliases,
  sampleValues: c.sampleValues
})))}

AVAILABLE ANALYTICS:
${JSON.stringify({
  metrics: analyticalContext.availableMetrics.map(m => m.column),
  dimensions: analyticalContext.availableDimensions.map(d => d.column),
  dates: analyticalContext.temporalColumns.map(t => t.column)
})}

CONVERSATION HISTORY:
${conversationContext.contextSummary || 'No prior turns.'}
Last Active Metric: ${conversationContext.lastMetric || 'None'}
Last Active Dimension: ${conversationContext.lastEntity || 'None'}

USER QUESTION: "${question}"`;

    const rawResponse = await llmService.generate(systemPrompt);
    if (!rawResponse || typeof rawResponse !== 'object') {
      throw new Error('LLM returned invalid or non-JSON query plan response');
    }

    return createQueryPlan(rawResponse);
  }
}

module.exports = new LLMQueryPlanner();
