/**
 * Aggregation Compatibility Engine
 *
 * This is the SINGLE SOURCE OF TRUTH for which aggregations are:
 *   - ALLOWED   (valid for the semantic role)
 *   - PREFERRED (the best default aggregation)
 *   - FORBIDDEN (semantically invalid — must never pass through)
 *
 * Every KPI and chart recommendation — regardless of source
 * (rule engine, LLM, fallback, or user input) — MUST pass through
 * this validation before reaching the dashboard configuration.
 *
 * Semantic roles referenced here match semanticClassifier.SEMANTIC_ROLES.
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');

// ---------------------------------------------------------------------------
// Aggregation constants
// ---------------------------------------------------------------------------
const AGGREGATIONS = {
  SUM: 'sum',
  AVG: 'avg',
  COUNT: 'count',
  COUNT_DISTINCT: 'count_distinct',
  DISTINCT: 'distinct',   // alias for count_distinct
  MIN: 'min',
  MAX: 'max',
  MEDIAN: 'median',
  DISTRIBUTION: 'distribution',
  PERCENTAGE_DIST: 'percentage_distribution',
  GROUP_BY: 'group_by',
  DATE_GROUPING: 'date_grouping',
  TREND: 'trend',
  NONE: 'none'
};

// ---------------------------------------------------------------------------
// Aggregation rules per semantic role
// ---------------------------------------------------------------------------
const AGGREGATION_RULES = {

  [SEMANTIC_ROLES.MONETARY_METRIC]: {
    allowed: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX],
    preferred: [AGGREGATIONS.SUM, AGGREGATIONS.AVG],
    forbidden: [],
    defaultAggregation: AGGREGATIONS.SUM,
    notes: 'Monetary metrics support SUM (total), AVG (per-unit average), and range queries.'
  },

  [SEMANTIC_ROLES.ADDITIVE_METRIC]: {
    allowed: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX, AGGREGATIONS.COUNT],
    preferred: [AGGREGATIONS.SUM, AGGREGATIONS.AVG],
    forbidden: [],
    defaultAggregation: AGGREGATIONS.SUM,
    notes: 'Count/volume metrics — SUM gives total, AVG gives per-group average.'
  },

  [SEMANTIC_ROLES.PERCENTAGE_METRIC]: {
    allowed: [AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX],
    preferred: [AGGREGATIONS.AVG],
    forbidden: [AGGREGATIONS.SUM],
    defaultAggregation: AGGREGATIONS.AVG,
    notes: 'Percentages cannot be summed (e.g., SUM(Attendance%) is meaningless). Use AVG.'
  },

  [SEMANTIC_ROLES.ORDINAL_METRIC]: {
    allowed: [AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX, AGGREGATIONS.DISTRIBUTION, AGGREGATIONS.COUNT],
    preferred: [AGGREGATIONS.AVG, AGGREGATIONS.DISTRIBUTION],
    forbidden: [AGGREGATIONS.SUM],
    defaultAggregation: AGGREGATIONS.AVG,
    notes: 'Ordinal metrics (ratings, scores) cannot be summed. AVG and distribution analysis are meaningful.'
  },

  [SEMANTIC_ROLES.RATIO_METRIC]: {
    allowed: [AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX],
    preferred: [AGGREGATIONS.AVG],
    forbidden: [AGGREGATIONS.SUM],
    defaultAggregation: AGGREGATIONS.AVG,
    notes: 'Ratios and indices cannot be summed. Use AVG or median.'
  },

  [SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]: {
    allowed: [AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX, AGGREGATIONS.DISTRIBUTION],
    preferred: [AGGREGATIONS.AVG, AGGREGATIONS.DISTRIBUTION],
    forbidden: [AGGREGATIONS.SUM],
    defaultAggregation: AGGREGATIONS.AVG,
    notes: 'Demographic attributes like Age cannot be summed. AVG gives meaningful central tendency.'
  },

  [SEMANTIC_ROLES.NON_ADDITIVE_METRIC]: {
    allowed: [AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX, AGGREGATIONS.DISTRIBUTION],
    preferred: [AGGREGATIONS.AVG],
    forbidden: [AGGREGATIONS.SUM],
    defaultAggregation: AGGREGATIONS.AVG,
    notes: 'Non-additive metrics cannot be meaningfully summed.'
  },

  [SEMANTIC_ROLES.IDENTIFIER]: {
    allowed: [AGGREGATIONS.COUNT, AGGREGATIONS.COUNT_DISTINCT, AGGREGATIONS.DISTINCT],
    preferred: [AGGREGATIONS.COUNT_DISTINCT],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN, AGGREGATIONS.MIN, AGGREGATIONS.MAX],
    defaultAggregation: AGGREGATIONS.COUNT_DISTINCT,
    notes: 'Identifiers can only be counted or counted distinctly. Never summed or averaged.'
  },

  [SEMANTIC_ROLES.CATEGORICAL_DIMENSION]: {
    allowed: [AGGREGATIONS.COUNT, AGGREGATIONS.COUNT_DISTINCT, AGGREGATIONS.GROUP_BY, AGGREGATIONS.PERCENTAGE_DIST],
    preferred: [AGGREGATIONS.GROUP_BY, AGGREGATIONS.COUNT],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN],
    defaultAggregation: AGGREGATIONS.GROUP_BY,
    notes: 'Categorical dimensions are used as grouping keys. Count and group_by are valid.'
  },

  [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION]: {
    allowed: [AGGREGATIONS.COUNT, AGGREGATIONS.COUNT_DISTINCT, AGGREGATIONS.GROUP_BY, AGGREGATIONS.PERCENTAGE_DIST],
    preferred: [AGGREGATIONS.GROUP_BY, AGGREGATIONS.COUNT],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN],
    defaultAggregation: AGGREGATIONS.GROUP_BY,
    notes: 'Geographic dimensions are grouping keys for regional analysis.'
  },

  [SEMANTIC_ROLES.STATUS_DIMENSION]: {
    allowed: [AGGREGATIONS.COUNT, AGGREGATIONS.PERCENTAGE_DIST, AGGREGATIONS.GROUP_BY],
    preferred: [AGGREGATIONS.COUNT, AGGREGATIONS.PERCENTAGE_DIST],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN],
    defaultAggregation: AGGREGATIONS.COUNT,
    notes: 'Status/flag dimensions can only be counted or used for distribution analysis.'
  },

  [SEMANTIC_ROLES.TEMPORAL_DIMENSION]: {
    allowed: [AGGREGATIONS.MIN, AGGREGATIONS.MAX, AGGREGATIONS.DATE_GROUPING, AGGREGATIONS.TREND, AGGREGATIONS.COUNT],
    preferred: [AGGREGATIONS.TREND, AGGREGATIONS.DATE_GROUPING],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG],
    defaultAggregation: AGGREGATIONS.TREND,
    notes: 'Date columns are used for time-series grouping and trend analysis.'
  },

  [SEMANTIC_ROLES.TEXT_ATTRIBUTE]: {
    allowed: [AGGREGATIONS.COUNT, AGGREGATIONS.COUNT_DISTINCT],
    preferred: [AGGREGATIONS.COUNT],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN],
    defaultAggregation: AGGREGATIONS.COUNT,
    notes: 'High-cardinality text fields can only be counted.'
  },

  [SEMANTIC_ROLES.CONTACT_INFORMATION]: {
    allowed: [],
    preferred: [],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.COUNT, AGGREGATIONS.COUNT_DISTINCT],
    defaultAggregation: null,
    notes: 'Contact information should be excluded from analytics entirely.'
  },

  [SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE]: {
    allowed: [AGGREGATIONS.COUNT],
    preferred: [],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG, AGGREGATIONS.MEDIAN],
    defaultAggregation: AGGREGATIONS.COUNT,
    notes: 'Sensitive PII attributes should not be analyzed. Excluded from most analytics.'
  },

  [SEMANTIC_ROLES.UNKNOWN]: {
    allowed: [AGGREGATIONS.COUNT],
    preferred: [AGGREGATIONS.COUNT],
    forbidden: [AGGREGATIONS.SUM, AGGREGATIONS.AVG],
    defaultAggregation: AGGREGATIONS.COUNT,
    notes: 'Unknown columns default to count-only aggregation.'
  }
};

// ---------------------------------------------------------------------------
// Validation API
// ---------------------------------------------------------------------------

/**
 * Validates whether an aggregation is permitted for a semantic role.
 *
 * @param {string} semanticRole - The semantic role of the column
 * @param {string} aggregation - The proposed aggregation
 * @returns {{ valid: boolean, reason: string, suggestedAggregation: string|null }}
 */
const validateAggregation = (semanticRole, aggregation) => {
  const rules = AGGREGATION_RULES[semanticRole];

  if (!rules) {
    return {
      valid: false,
      reason: `Unknown semantic role: "${semanticRole}"`,
      suggestedAggregation: AGGREGATIONS.COUNT
    };
  }

  const aggNorm = (aggregation || '').toLowerCase().trim();

  // Check if it's explicitly forbidden
  if (rules.forbidden.includes(aggNorm)) {
    return {
      valid: false,
      reason: `Aggregation "${aggNorm}" is FORBIDDEN for semantic role "${semanticRole}". ${rules.notes}`,
      suggestedAggregation: rules.defaultAggregation
    };
  }

  // Check if it's explicitly allowed
  if (rules.allowed.includes(aggNorm) || aggNorm === 'none') {
    return {
      valid: true,
      reason: `Aggregation "${aggNorm}" is valid for semantic role "${semanticRole}"`,
      suggestedAggregation: null
    };
  }

  // Not in allowed list and not forbidden — treat as invalid
  return {
    valid: false,
    reason: `Aggregation "${aggNorm}" is not supported for semantic role "${semanticRole}". Allowed: [${rules.allowed.join(', ')}]`,
    suggestedAggregation: rules.defaultAggregation
  };
};

/**
 * Returns the preferred aggregation for a semantic role.
 *
 * @param {string} semanticRole
 * @returns {string}
 */
const getPreferredAggregation = (semanticRole) => {
  const rules = AGGREGATION_RULES[semanticRole];
  if (!rules) return AGGREGATIONS.COUNT;
  return rules.defaultAggregation || rules.preferred[0] || AGGREGATIONS.COUNT;
};

/**
 * Returns the full rules object for a semantic role.
 *
 * @param {string} semanticRole
 * @returns {Object}
 */
const getRules = (semanticRole) => {
  return AGGREGATION_RULES[semanticRole] || null;
};

/**
 * Checks if a semantic role should be completely excluded from analytics.
 *
 * @param {string} semanticRole
 * @returns {boolean}
 */
const isExcludedFromAnalytics = (semanticRole) => {
  return semanticRole === SEMANTIC_ROLES.CONTACT_INFORMATION ||
    semanticRole === SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE;
};

/**
 * Checks if a semantic role should be excluded from appearing as a KPI metric.
 *
 * @param {string} semanticRole
 * @returns {boolean}
 */
const isExcludedFromKPI = (semanticRole) => {
  return [
    SEMANTIC_ROLES.IDENTIFIER,
    SEMANTIC_ROLES.CATEGORICAL_DIMENSION,
    SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION,
    SEMANTIC_ROLES.TEXT_ATTRIBUTE,
    SEMANTIC_ROLES.CONTACT_INFORMATION,
    SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE,
    SEMANTIC_ROLES.TEMPORAL_DIMENSION,
    SEMANTIC_ROLES.STATUS_DIMENSION,
    SEMANTIC_ROLES.UNKNOWN
  ].includes(semanticRole);
};

/**
 * Maps a legacy aggregation string to a normalized form.
 * Handles aliases like 'distinct' → 'count_distinct'.
 *
 * @param {string} agg
 * @returns {string}
 */
const normalizeAggregation = (agg) => {
  const map = {
    'distinct': 'count_distinct',
    'count distinct': 'count_distinct',
    'countdistinct': 'count_distinct',
    'average': 'avg',
    'mean': 'avg',
    'total': 'sum',
    'percent distribution': 'percentage_distribution'
  };
  const lower = (agg || '').toLowerCase().trim();
  return map[lower] || lower;
};

module.exports = {
  AGGREGATIONS,
  AGGREGATION_RULES,
  validateAggregation,
  getPreferredAggregation,
  getRules,
  isExcludedFromAnalytics,
  isExcludedFromKPI,
  normalizeAggregation
};
