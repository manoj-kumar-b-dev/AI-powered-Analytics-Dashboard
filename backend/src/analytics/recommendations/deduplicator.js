/**
 * Redundancy Deduplicator
 *
 * Detects and removes semantically duplicate recommendations.
 *
 * A "semantic duplicate" is defined as two recommendations that analyze
 * the same business question, even if titled differently.
 *
 * Signature for KPIs: { column + aggregation }
 * Signature for Charts: { xField + yField + aggregation } (normalized)
 *
 * Also prevents near-duplicates like:
 *   - "Employee Count by Department" vs "Department Distribution" vs "Employees per Department"
 *   All three share: xField=Department + yField=_count + aggregation=count
 *   → Keep only the highest-scoring one.
 */

// ---------------------------------------------------------------------------
// KPI Deduplication
// ---------------------------------------------------------------------------

/**
 * Generates a canonical signature for a KPI candidate.
 * Two KPIs with the same signature are considered duplicates.
 *
 * @param {Object} kpi
 * @returns {string}
 */
const getKPISignature = (kpi) => {
  const col = (kpi.column || '').toLowerCase();
  const agg = (kpi.aggregation || '').toLowerCase();
  return `kpi::${col}::${agg}`;
};

/**
 * Deduplicates an array of KPI candidates.
 * When duplicates are found, keeps the highest-scoring one.
 *
 * @param {Array<Object>} kpiCandidates - Already scored and sorted
 * @returns {Array<Object>}
 */
const deduplicateKPIs = (kpiCandidates) => {
  const seen = new Map(); // signature → candidate

  for (const kpi of kpiCandidates) {
    const sig = getKPISignature(kpi);
    const existing = seen.get(sig);

    if (!existing) {
      seen.set(sig, kpi);
    } else if ((kpi.score || 0) > (existing.score || 0)) {
      // Replace with higher-scoring version
      console.log(`[Deduplicator] KPI "${kpi.title}" replaces "${existing.title}" (same signature, higher score)`);
      seen.set(sig, kpi);
    } else {
      console.log(`[Deduplicator] KPI "${kpi.title}" is duplicate of "${existing.title}" — discarded`);
    }
  }

  return Array.from(seen.values());
};

// ---------------------------------------------------------------------------
// Chart Deduplication
// ---------------------------------------------------------------------------

/**
 * Generates a canonical signature for a chart candidate.
 *
 * Normalization:
 *   - xField and yField are lowercased
 *   - Sorts so the "axis pair" is order-independent for scatter charts
 *   - Aggregation is normalized
 *
 * @param {Object} chart
 * @returns {string}
 */
const getChartSignature = (chart) => {
  const x = (chart.xField || '').toLowerCase();
  const y = (chart.yField || '').toLowerCase().replace('_count', 'count');
  const agg = (chart.aggregation || '').toLowerCase();
  const type = (chart.chartType || '').toLowerCase();

  // For scatter charts, axis pair is unordered
  if (type === 'scatter') {
    const pair = [x, y].sort().join('::');
    return `chart::scatter::${pair}::${agg}`;
  }

  return `chart::${type}::${x}::${y}::${agg}`;
};

/**
 * Generates a "semantic intent" key to catch near-duplicates with different chart types.
 * e.g., "Employee Count by Department" (bar) and "Department Breakdown" (pie) both
 * analyze the same thing.
 *
 * Intent key: x_field::y_field::aggregation (without chart type)
 *
 * @param {Object} chart
 * @returns {string}
 */
const getChartIntentSignature = (chart) => {
  const x = (chart.xField || '').toLowerCase();
  const y = (chart.yField || '').toLowerCase().replace('_count', 'count');
  const agg = (chart.aggregation || '').toLowerCase();
  return `intent::${x}::${y}::${agg}`;
};

/**
 * Deduplicates chart candidates.
 *
 * Two-pass deduplication:
 *   1. Exact signature deduplication (same chart type + same axes + same aggregation)
 *   2. Intent-based deduplication (same data question, different chart type) — keep best scoring
 *
 * @param {Array<Object>} chartCandidates - Already scored and sorted
 * @returns {Array<Object>}
 */
const deduplicateCharts = (chartCandidates) => {
  // Pass 1: exact deduplication
  const exactSeen = new Map();
  for (const chart of chartCandidates) {
    const sig = getChartSignature(chart);
    const existing = exactSeen.get(sig);
    if (!existing) {
      exactSeen.set(sig, chart);
    } else if ((chart.score || 0) > (existing.score || 0)) {
      console.log(`[Deduplicator] Chart "${chart.title}" replaces "${existing.title}" (exact duplicate, higher score)`);
      exactSeen.set(sig, chart);
    } else {
      console.log(`[Deduplicator] Chart "${chart.title}" is exact duplicate of "${existing.title}" — discarded`);
    }
  }

  const afterExact = Array.from(exactSeen.values());

  // Pass 2: intent-based deduplication
  const intentSeen = new Map();
  for (const chart of afterExact) {
    const intent = getChartIntentSignature(chart);
    const existing = intentSeen.get(intent);
    if (!existing) {
      intentSeen.set(intent, chart);
    } else if ((chart.score || 0) > (existing.score || 0)) {
      console.log(`[Deduplicator] Chart "${chart.title}" replaces "${existing.title}" (same analysis intent, higher score)`);
      intentSeen.set(intent, chart);
    } else {
      console.log(`[Deduplicator] Chart "${chart.title}" has same intent as "${existing.title}" — discarded`);
    }
  }

  return Array.from(intentSeen.values());
};

// ---------------------------------------------------------------------------
// Recommendation limits
// ---------------------------------------------------------------------------
const LIMITS = {
  KPI_MIN: 3,
  KPI_PREFERRED: 5,
  KPI_MAX: 6,
  PRIMARY_CHART_MIN: 2,
  PRIMARY_CHART_PREFERRED: 5,
  PRIMARY_CHART_MAX: 6,
  SECONDARY_CHART_MAX: 3,
  TOTAL_CHART_MAX: 6
};

/**
 * Applies limits to final KPI list.
 * Respects minimum: if fewer than KPI_MIN valid KPIs exist, returns all (no padding).
 *
 * @param {Array<Object>} rankedKPIs
 * @returns {Array<Object>}
 */
const applyKPILimits = (rankedKPIs) => {
  return rankedKPIs.slice(0, LIMITS.KPI_MAX);
};

/**
 * Applies limits to final chart list.
 * Balances primary and secondary charts.
 *
 * @param {Array<Object>} rankedCharts
 * @returns {Array<Object>}
 */
const applyChartLimits = (rankedCharts) => {
  const primary = rankedCharts.filter(c => c.priority === 'primary');
  const secondary = rankedCharts.filter(c => c.priority !== 'primary');

  const primarySlice = primary.slice(0, LIMITS.PRIMARY_CHART_MAX);
  const remainingSlots = LIMITS.TOTAL_CHART_MAX - primarySlice.length;
  const secondarySlice = secondary.slice(0, Math.min(LIMITS.SECONDARY_CHART_MAX, remainingSlots));

  return [...primarySlice, ...secondarySlice];
};

module.exports = {
  deduplicateKPIs,
  deduplicateCharts,
  applyKPILimits,
  applyChartLimits,
  getKPISignature,
  getChartSignature,
  LIMITS
};
