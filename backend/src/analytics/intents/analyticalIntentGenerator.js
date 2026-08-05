/**
 * Analytical Intent Generator
 *
 * Converts discovered analytical capabilities into concrete, actionable
 * analytical intents. Each intent maps 1:1 to a KPI card or chart widget.
 *
 * Intent types:
 *   KPI_AGGREGATE       — "What is the total/avg/count of [metric]?"
 *   KPI_ENTITY_COUNT    — "How many unique [entities] are there?"
 *   TIME_SERIES         — "How has [metric] changed over time?"
 *   CATEGORICAL_BREAKDOWN — "How does [metric] differ by [dimension]?"
 *   FREQUENCY_DISTRIBUTION — "How often does each [category] appear?"
 *   PROPORTION          — "What is the composition of [dimension]?"
 *   CORRELATION         — "Is there a relationship between [metric1] and [metric2]?"
 *
 * Output feeds universalKPIGenerator and universalChartGenerator.
 * Domain context is advisory only and does NOT control which intents are created.
 */

const { CAPABILITIES } = require('../capabilities/capabilityDiscoveryEngine');
const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { getPreferredAggregation } = require('../aggregation/aggregationRules');

// ---------------------------------------------------------------------------
// Intent type constants
// ---------------------------------------------------------------------------
const INTENT_TYPES = {
  KPI_AGGREGATE: 'kpi_aggregate',
  KPI_ENTITY_COUNT: 'kpi_entity_count',
  TIME_SERIES: 'time_series',
  CATEGORICAL_BREAKDOWN: 'categorical_breakdown',
  FREQUENCY_DISTRIBUTION: 'frequency_distribution',
  PROPORTION: 'proportion',
  CORRELATION: 'correlation'
};

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

// KPI base analytical value by semantic role (replaces hardcoded domain relevance score)
const KPI_ROLE_VALUE = {
  [SEMANTIC_ROLES.MONETARY_METRIC]: 95,
  [SEMANTIC_ROLES.ADDITIVE_METRIC]: 85,
  [SEMANTIC_ROLES.PERCENTAGE_METRIC]: 75,
  [SEMANTIC_ROLES.ORDINAL_METRIC]: 72,
  [SEMANTIC_ROLES.RATIO_METRIC]: 70,
  [SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]: 65,
  [SEMANTIC_ROLES.NON_ADDITIVE_METRIC]: 60,
  [SEMANTIC_ROLES.UNKNOWN]: 40
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generates KPI and chart analytical intents from discovered capabilities.
 *
 * @param {Array<Object>} capabilities    - From discoverCapabilities()
 * @param {Map<string, Object>} columnSemantics - From classifyColumns()
 * @param {Object} [domainContext]        - Optional { domain, confidence } — advisory only
 * @returns {{ kpiIntents: Array, chartIntents: Array }}
 */
const generateIntents = (capabilities, columnSemantics, domainContext = null) => {
  const kpiIntents = [];
  const chartIntents = [];

  // Build capability lookup map for quick access
  const capMap = new Map(capabilities.map(c => [c.capability, c]));

  // ─── KPI INTENTS ──────────────────────────────────────────────────────────

  // KPI_AGGREGATE: one intent per aggregatable measure column
  for (const [colName, sem] of columnSemantics.entries()) {
    if (!sem.isAggregatable || sem.isIdentifier || sem.isSensitive || sem.isTemporal) continue;

    const preferredAgg = getPreferredAggregation(sem.semanticRole);
    // Skip roles that don't produce meaningful scalar KPIs
    if (!preferredAgg || preferredAgg === 'group_by' || preferredAgg === 'date_grouping' || preferredAgg === 'trend') continue;

    const analyticalValue = KPI_ROLE_VALUE[sem.semanticRole] || 50;

    kpiIntents.push({
      type: INTENT_TYPES.KPI_AGGREGATE,
      column: colName,
      aggregation: preferredAgg,
      semanticRole: sem.semanticRole,
      priority: (sem.semanticRole === SEMANTIC_ROLES.MONETARY_METRIC || sem.semanticRole === SEMANTIC_ROLES.ADDITIVE_METRIC) ? 'primary' : 'secondary',
      analyticalValue,
      businessReason: `${preferredAgg.toUpperCase()} of ${colName} provides a key dataset metric`,
      source: 'universal'
    });
  }

  // KPI_ENTITY_COUNT: count_distinct for identifier columns
  const entityCap = capMap.get(CAPABILITIES.ENTITY_COUNT);
  if (entityCap) {
    for (const rel of entityCap.supportingRelationships) {
      kpiIntents.push({
        type: INTENT_TYPES.KPI_ENTITY_COUNT,
        column: rel.xColumn,
        aggregation: 'count_distinct',
        semanticRole: SEMANTIC_ROLES.IDENTIFIER,
        priority: 'primary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Distinct count of ${rel.xColumn} measures the number of unique entities in the dataset`,
        source: 'universal'
      });
    }
  }

  // ─── CHART INTENTS ────────────────────────────────────────────────────────

  // TIME_SERIES: one intent per temporal-measure relationship
  const timeSeriesCap = capMap.get(CAPABILITIES.TIME_SERIES);
  if (timeSeriesCap) {
    // Sort by analytical value, limit to top relationships to avoid chart overload
    const topPairs = timeSeriesCap.supportingRelationships
      .sort((a, b) => b.analyticalValue - a.analyticalValue)
      .slice(0, 4);

    for (const rel of topPairs) {
      const sem = columnSemantics.get(rel.yColumn);
      const agg = sem ? getPreferredAggregation(sem.semanticRole) : 'sum';
      chartIntents.push({
        type: INTENT_TYPES.TIME_SERIES,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: (agg === 'group_by' || agg === 'trend' || agg === 'date_grouping') ? 'sum' : agg,
        preferredChartType: 'line',
        priority: rel.analyticalValue >= 90 ? 'primary' : 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Track how ${rel.yColumn} changes over time`,
        source: 'universal'
      });
    }
  }

  // CATEGORICAL_BREAKDOWN: dimension × measure
  const breakdownCap = capMap.get(CAPABILITIES.BREAKDOWN);
  if (breakdownCap) {
    const topPairs = breakdownCap.supportingRelationships
      .sort((a, b) => b.analyticalValue - a.analyticalValue)
      .slice(0, 5);

    for (const rel of topPairs) {
      const sem = columnSemantics.get(rel.yColumn);
      const agg = sem ? getPreferredAggregation(sem.semanticRole) : 'sum';
      chartIntents.push({
        type: INTENT_TYPES.CATEGORICAL_BREAKDOWN,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: (agg === 'group_by' || agg === 'trend' || agg === 'date_grouping') ? 'count' : agg,
        preferredChartType: 'bar',
        priority: rel.analyticalValue >= 78 ? 'primary' : 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Compare ${rel.yColumn} across different ${rel.xColumn} groups`,
        source: 'universal'
      });
    }
  }

  // FREQUENCY_DISTRIBUTION: dimension × count
  const freqCap = capMap.get(CAPABILITIES.FREQUENCY);
  if (freqCap) {
    // Only use top frequency relationships to avoid dashboard overload
    const topFreq = freqCap.supportingRelationships
      .sort((a, b) => b.analyticalValue - a.analyticalValue)
      .slice(0, 3);

    for (const rel of topFreq) {
      chartIntents.push({
        type: INTENT_TYPES.FREQUENCY_DISTRIBUTION,
        xColumn: rel.xColumn,
        yColumn: '_count',
        aggregation: 'count',
        preferredChartType: 'bar',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Show how frequently each ${rel.xColumn} value appears`,
        source: 'universal'
      });
    }
  }

  // PROPORTION: low/binary cardinality dimension for pie charts
  const proportionCap = capMap.get(CAPABILITIES.PROPORTION);
  if (proportionCap) {
    const topProp = proportionCap.supportingRelationships
      .sort((a, b) => b.analyticalValue - a.analyticalValue)
      .slice(0, 2);

    for (const rel of topProp) {
      chartIntents.push({
        type: INTENT_TYPES.PROPORTION,
        xColumn: rel.xColumn,
        yColumn: '_count',
        aggregation: 'count',
        preferredChartType: 'pie',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Show proportional breakdown of ${rel.xColumn}`,
        source: 'universal'
      });
    }
  }

  // CORRELATION: measure × measure (scatter plots)
  const corrCap = capMap.get(CAPABILITIES.CORRELATION);
  if (corrCap) {
    // Limit to top 2 correlation pairs to avoid scatter plot overload
    const topCorr = corrCap.supportingRelationships
      .slice(0, 2);

    for (const rel of topCorr) {
      chartIntents.push({
        type: INTENT_TYPES.CORRELATION,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: 'none',
        preferredChartType: 'scatter',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Explore the relationship between ${rel.xColumn} and ${rel.yColumn}`,
        source: 'universal'
      });
    }
  }

  return { kpiIntents, chartIntents };
};

module.exports = { generateIntents, INTENT_TYPES };
