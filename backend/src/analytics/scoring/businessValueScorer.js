/**
 * Business Value Scorer
 *
 * Scores every KPI and chart candidate from 0 to 100.
 * Candidates scoring 0 should be rejected before this point (by aggregation validation).
 * This scorer ranks valid candidates by business usefulness.
 *
 * Weighting:
 *   Domain Relevance:         25%
 *   Semantic Validity:        20%
 *   Business Usefulness:      20%
 *   Aggregation Suitability:  15%
 *   Data Quality:             10%
 *   Visualization Suitability: 5%
 *   Uniqueness/Non-Redundancy: 5%
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { AGGREGATIONS, getRules } = require('../aggregation/aggregationRules');

// ---------------------------------------------------------------------------
// Role business value scores (how much a semantic role contributes to insight)
// ---------------------------------------------------------------------------
const ROLE_BUSINESS_VALUE = {
  [SEMANTIC_ROLES.MONETARY_METRIC]:     95,
  [SEMANTIC_ROLES.ADDITIVE_METRIC]:     85,
  [SEMANTIC_ROLES.PERCENTAGE_METRIC]:   80,
  [SEMANTIC_ROLES.ORDINAL_METRIC]:      72,
  [SEMANTIC_ROLES.RATIO_METRIC]:        70,
  [SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]: 60,
  [SEMANTIC_ROLES.STATUS_DIMENSION]:    75,
  [SEMANTIC_ROLES.CATEGORICAL_DIMENSION]: 70,
  [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION]: 65,
  [SEMANTIC_ROLES.TEMPORAL_DIMENSION]:  80,
  [SEMANTIC_ROLES.IDENTIFIER]:          50,
  [SEMANTIC_ROLES.TEXT_ATTRIBUTE]:      30,
  [SEMANTIC_ROLES.CONTACT_INFORMATION]: 0,
  [SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE]: 0,
  [SEMANTIC_ROLES.NON_ADDITIVE_METRIC]: 55,
  [SEMANTIC_ROLES.UNKNOWN]:             20
};

// ---------------------------------------------------------------------------
// Aggregation suitability scores per semantic role
// ---------------------------------------------------------------------------
const getAggregationSuitabilityScore = (semanticRole, aggregation) => {
  const rules = getRules(semanticRole);
  if (!rules) return 0;

  const agg = (aggregation || '').toLowerCase();

  if (rules.forbidden.includes(agg)) return 0;

  if (rules.preferred.includes(agg)) return 100;

  if (rules.allowed.includes(agg)) return 70;

  return 0;
};

// ---------------------------------------------------------------------------
// Chart type suitability scores
// ---------------------------------------------------------------------------
const CHART_TYPE_DIMENSION_SUITABILITY = {
  // dimension role → chart type → suitability score
  [SEMANTIC_ROLES.TEMPORAL_DIMENSION]: { line: 100, area: 95, bar: 65, pie: 20, scatter: 30 },
  [SEMANTIC_ROLES.CATEGORICAL_DIMENSION]: { bar: 100, pie: 85, line: 45, area: 40, scatter: 20 },
  [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION]: { bar: 90, pie: 70, line: 40, area: 35, scatter: 20 },
  [SEMANTIC_ROLES.STATUS_DIMENSION]: { pie: 100, bar: 85, line: 30, area: 25, scatter: 10 },
  [SEMANTIC_ROLES.ORDINAL_METRIC]: { bar: 90, pie: 60, line: 55, area: 50, scatter: 30 },
  [SEMANTIC_ROLES.IDENTIFIER]: { bar: 70, pie: 50, line: 30, area: 25, scatter: 10 }
};

const getChartTypeSuitabilityScore = (chartType, xSemanticRole) => {
  const roleMap = CHART_TYPE_DIMENSION_SUITABILITY[xSemanticRole];
  if (!roleMap) return 50;
  return roleMap[(chartType || '').toLowerCase()] || 40;
};

// ---------------------------------------------------------------------------
// KPI Scorer
// ---------------------------------------------------------------------------

/**
 * Scores a KPI candidate.
 *
 * @param {Object} candidate - KPI candidate with semanticRole, aggregation, domainRelevance
 * @param {number} dataQualityScore - 0-100 based on missing value % for this column
 * @returns {number} Score 0-100
 */
const scoreKPI = (candidate, dataQualityScore = 80) => {
  const {
    semanticRole,
    aggregation,
    domainRelevance = 70,
    priority
  } = candidate;

  // Domain Relevance (25%)
  const domainScore = Math.min(100, domainRelevance);

  // Semantic Validity (20%) — based on the business value of this role
  const semanticScore = ROLE_BUSINESS_VALUE[semanticRole] || 30;

  // Business Usefulness (20%) — boosted for primary KPIs
  const usefulnessScore = priority === 'primary' ? 90 : 65;

  // Aggregation Suitability (15%)
  const aggScore = getAggregationSuitabilityScore(semanticRole, aggregation);

  // Data Quality (10%)
  const qualityScore = dataQualityScore;

  // Uniqueness (5%) — handled by deduplicator, give base score here
  const uniquenessScore = 80;

  // Visualization N/A for KPI (use business usefulness as proxy, 5%)
  const vizScore = usefulnessScore;

  const total =
    (domainScore    * 0.25) +
    (semanticScore  * 0.20) +
    (usefulnessScore * 0.20) +
    (aggScore       * 0.15) +
    (qualityScore   * 0.10) +
    (vizScore       * 0.05) +
    (uniquenessScore * 0.05);

  return Math.round(Math.min(100, Math.max(0, total)));
};

// ---------------------------------------------------------------------------
// Chart Scorer
// ---------------------------------------------------------------------------

/**
 * Scores a chart candidate.
 *
 * @param {Object} candidate - Chart candidate with chartType, xSemanticRole, ySemanticRole, aggregation
 * @param {number} dataQualityScore - 0-100
 * @returns {number} Score 0-100
 */
const scoreChart = (candidate, dataQualityScore = 80) => {
  const {
    chartType,
    xSemanticRole,
    ySemanticRole,
    aggregation,
    priority,
    xField,
    yField
  } = candidate;

  // Special case: count-only charts are always valid
  const isCountChart = yField === '_count' || aggregation === AGGREGATIONS.COUNT;

  // Domain Relevance (25%)
  const domainScore = priority === 'primary' ? 90 : 65;

  // Semantic Validity (20%)
  const xRoleScore = ROLE_BUSINESS_VALUE[xSemanticRole] || 30;
  const yRoleScore = isCountChart ? 80 : (ROLE_BUSINESS_VALUE[ySemanticRole] || 30);
  const semanticScore = (xRoleScore + yRoleScore) / 2;

  // Business Usefulness (20%)
  const usefulnessScore = priority === 'primary' ? 88 : 62;

  // Aggregation Suitability (15%)
  let aggScore = 80; // default for count charts
  if (!isCountChart && ySemanticRole) {
    aggScore = getAggregationSuitabilityScore(ySemanticRole, aggregation);
  }

  // Data Quality (10%)
  const qualityScore = dataQualityScore;

  // Visualization Suitability (5%)
  const vizScore = getChartTypeSuitabilityScore(chartType, xSemanticRole);

  // Uniqueness (5%) — handled by deduplicator
  const uniquenessScore = 80;

  const total =
    (domainScore     * 0.25) +
    (semanticScore   * 0.20) +
    (usefulnessScore * 0.20) +
    (aggScore        * 0.15) +
    (qualityScore    * 0.10) +
    (vizScore        * 0.05) +
    (uniquenessScore * 0.05);

  return Math.round(Math.min(100, Math.max(0, total)));
};

// ---------------------------------------------------------------------------
// Batch scoring
// ---------------------------------------------------------------------------

/**
 * Scores and sorts an array of KPI candidates.
 *
 * @param {Array<Object>} kpiCandidates
 * @param {Map<string, number>} [columnQualityMap] - Map of column → data quality score (0-100)
 * @returns {Array<Object>} Sorted candidates with .score added
 */
const scoreAndRankKPIs = (kpiCandidates, columnQualityMap = new Map()) => {
  return kpiCandidates
    .map(c => ({
      ...c,
      score: scoreKPI(c, columnQualityMap.get(c.column) || 80)
    }))
    .sort((a, b) => {
      // Primary sort: score
      if (b.score !== a.score) return b.score - a.score;
      // Secondary sort: primary before secondary
      if (a.priority === 'primary' && b.priority !== 'primary') return -1;
      if (a.priority !== 'primary' && b.priority === 'primary') return 1;
      return 0;
    });
};

/**
 * Scores and sorts an array of chart candidates.
 *
 * @param {Array<Object>} chartCandidates
 * @param {Map<string, number>} [columnQualityMap]
 * @returns {Array<Object>} Sorted candidates with .score added
 */
const scoreAndRankCharts = (chartCandidates, columnQualityMap = new Map()) => {
  return chartCandidates
    .map(c => ({
      ...c,
      score: scoreChart(c, columnQualityMap.get(c.xField) || 80)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.priority === 'primary' && b.priority !== 'primary') return -1;
      if (a.priority !== 'primary' && b.priority === 'primary') return 1;
      return 0;
    });
};

/**
 * Calculates a data quality score for a column based on missing value percentage.
 *
 * @param {Object} col - Schema column with missingValuePercent
 * @returns {number} 0-100
 */
const getColumnQualityScore = (col) => {
  const missingPct = col.missingValuePercent || col.missing_percent || 0;
  return Math.max(0, 100 - (missingPct * 1.5));
};

/**
 * Builds a column quality map from a schema array.
 *
 * @param {Array} schema
 * @returns {Map<string, number>}
 */
const buildColumnQualityMap = (schema) => {
  const map = new Map();
  for (const col of (schema || [])) {
    const colName = col.column || col.name;
    if (colName) {
      map.set(colName, getColumnQualityScore(col));
    }
  }
  return map;
};

module.exports = {
  scoreKPI,
  scoreChart,
  scoreAndRankKPIs,
  scoreAndRankCharts,
  buildColumnQualityMap
};
