/**
 * Query Plan Schema Version 1.0 Definition & Validator Helpers
 */
const QUERY_PLAN_VERSION = '1.0';

const VALID_INTENTS = [
  'overall_summary',
  'group_by',
  'ranking',
  'top_n',
  'bottom_n',
  'compare_periods',
  'trend',
  'filter_and_aggregate'
];

const VALID_AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct'];
const VALID_VISUALIZATIONS = ['bar', 'line', 'pie', 'table', 'none'];

/**
 * Normalizes a raw LLM output into a strict Version 1.0 Query Plan object.
 */
function createQueryPlan(raw = {}) {
  return {
    schemaVersion: QUERY_PLAN_VERSION,
    intent: VALID_INTENTS.includes(raw.intent || raw.action) ? (raw.intent || raw.action) : 'group_by',
    metric: {
      column: raw.metric?.column || raw.metric || null,
      aggregation: VALID_AGGREGATIONS.includes(raw.metric?.aggregation || raw.aggregation)
        ? (raw.metric?.aggregation || raw.aggregation)
        : 'sum'
    },
    dimension: {
      column: raw.dimension?.column || raw.groupBy || raw.dimension || null
    },
    temporal: {
      column: raw.temporal?.column || raw.dateColumn || null,
      filter: raw.temporal?.filter || raw.dateFilter || null,
      periodType: raw.temporal?.periodType || raw.periodType || 'monthly'
    },
    filter: {
      column: raw.filter?.column || raw.filterColumn || null,
      value: raw.filter?.value ?? raw.filterValue ?? null
    },
    sort: {
      direction: raw.sort?.direction || raw.direction || 'desc'
    },
    limit: typeof raw.limit === 'number' ? Math.min(Math.max(raw.limit, 1), 20) : (raw.intent === 'overall_summary' ? null : 5),
    visualization: {
      type: VALID_VISUALIZATIONS.includes(raw.visualization?.type || raw.visualization)
        ? (raw.visualization?.type || raw.visualization)
        : 'bar'
    },
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.9,
    ambiguousOptions: Array.isArray(raw.ambiguousOptions) ? raw.ambiguousOptions : null
  };
}

module.exports = {
  QUERY_PLAN_VERSION,
  VALID_INTENTS,
  VALID_AGGREGATIONS,
  VALID_VISUALIZATIONS,
  createQueryPlan
};
