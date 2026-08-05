/**
 * Result Validator
 *
 * Post-execution validation of resolved chart data and KPI values.
 * Runs AFTER MongoDB aggregation queries complete and BEFORE the dashboard
 * configuration is assembled.
 *
 * Rejects charts that would render incorrectly or convey no information,
 * and rejects KPI values that are mathematically invalid.
 *
 * Chart rejection rules:
 *   - Empty result array (no data returned)
 *   - Only 1 data point (insufficient for a meaningful chart)
 *   - All Y values are null/undefined/NaN
 *   - Zero variance (all Y values are identical — chart is a flat line)
 *   - Pie chart where one slice dominates > 95% (breakdown is meaningless)
 *
 * KPI rejection rules:
 *   - value is null/undefined
 *   - value is NaN
 *   - value is Infinity/-Infinity
 */

const MIN_CHART_DATA_POINTS = 2;
const ZERO_VARIANCE_CV_THRESHOLD = 0.001;   // coefficient of variation threshold
const PIE_DOMINANCE_THRESHOLD = 0.95;       // single category dominates the whole

/**
 * Validates resolved chart data.
 *
 * @param {Object} chart - Chart object with resolvedData array
 * @returns {{ valid: boolean, reason: string|null, warning: string|null }}
 */
const validateChartResult = (chart) => {
  const data = chart.resolvedData || [];

  if (data.length === 0) {
    return { valid: false, reason: 'Aggregation returned no data', warning: null };
  }

  if (data.length < MIN_CHART_DATA_POINTS) {
    return {
      valid: false,
      reason: `Only ${data.length} data point(s) — chart requires at least ${MIN_CHART_DATA_POINTS}`,
      warning: null
    };
  }

  // Extract numeric Y values
  const yValues = data
    .map(d => d.y)
    .filter(y => y !== null && y !== undefined && !isNaN(Number(y)) && isFinite(Number(y)));

  if (yValues.length === 0) {
    return { valid: false, reason: 'All Y values are null, undefined, or NaN', warning: null };
  }

  // Zero-variance check: all identical values produce a meaningless chart
  if (yValues.length >= 2) {
    const mean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    if (Math.abs(mean) > 1e-10) {
      const variance = yValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / yValues.length;
      const cv = Math.sqrt(variance) / Math.abs(mean); // coefficient of variation
      if (cv < ZERO_VARIANCE_CV_THRESHOLD) {
        return {
          valid: false,
          reason: `Zero variance in Y values (all values ≈ ${mean.toFixed(4)}) — chart conveys no information`,
          warning: null
        };
      }
    }
  }

  // Pie chart dominance check (warning only — still render but flag)
  if (chart.type && (chart.type.includes('pie') || chart.config?.chartType === 'pie')) {
    const total = yValues.reduce((a, b) => a + Math.abs(b), 0);
    const maxVal = Math.max(...yValues.map(Math.abs));
    if (total > 0 && maxVal / total > PIE_DOMINANCE_THRESHOLD) {
      return {
        valid: true,
        reason: null,
        warning: `One category accounts for > ${Math.round(PIE_DOMINANCE_THRESHOLD * 100)}% of total — pie chart may not be informative`
      };
    }
  }

  return { valid: true, reason: null, warning: null };
};

/**
 * Validates a computed KPI card value.
 *
 * @param {Object} kpi - KPI card object with a numeric `value` field
 * @returns {{ valid: boolean, reason: string|null }}
 */
const validateKPIResult = (kpi) => {
  const v = kpi.value;

  if (v === null || v === undefined) {
    return { valid: false, reason: `KPI "${kpi.kpi || kpi.label}" has null value` };
  }
  if (typeof v === 'number' && isNaN(v)) {
    return { valid: false, reason: `KPI "${kpi.kpi || kpi.label}" value is NaN` };
  }
  if (typeof v === 'number' && !isFinite(v)) {
    return { valid: false, reason: `KPI "${kpi.kpi || kpi.label}" value is Infinity` };
  }

  return { valid: true, reason: null };
};

module.exports = { validateChartResult, validateKPIResult };
