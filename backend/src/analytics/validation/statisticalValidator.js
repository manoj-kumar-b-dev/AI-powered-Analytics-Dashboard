/**
 * Statistical Validator
 *
 * Pre-execution validation of KPI and chart candidates.
 * Rejects candidates that are structurally or statistically meaningless
 * before any MongoDB queries are executed.
 *
 * This runs AFTER intent generation and BEFORE scoring/deduplication.
 *
 * Validation rules for KPIs:
 *   - Reject columns with null ratio > MAX_NULL_RATIO_FOR_KPI (too sparse for a KPI)
 *   - Reject sensitive/contact columns
 *   - Reject non-aggregatable columns
 *
 * Validation rules for Charts:
 *   - Reject pie charts with cardinality > MAX_PIE_CATEGORIES
 *   - Reject categorical charts (bar) with cardinality > MAX_CATEGORICAL_CARDINALITY
 *     (unless the X axis is temporal — temporal can have many distinct dates)
 *   - Reject charts where X-axis is sensitive
 *   - Reject correlation (scatter) charts where either column is non-numeric
 */

const MAX_NULL_RATIO_FOR_KPI = 0.60;       // KPI requires at least 40% populated
const MAX_PIE_CATEGORIES = 10;              // Pie charts with > 10 slices are unreadable
const MAX_CATEGORICAL_CARDINALITY = 50;    // Bar charts grouping > 50 categories are cluttered

/**
 * Validates KPI candidates statistically.
 *
 * @param {Array<Object>} kpiCandidates
 * @param {Map<string, Object>} columnSemantics
 * @returns {{ valid: Array<Object>, rejected: Array<Object> }}
 */
const validateKPICandidates = (kpiCandidates, columnSemantics) => {
  const valid = [];
  const rejected = [];

  for (const candidate of kpiCandidates) {
    const sem = columnSemantics.get(candidate.column);

    if (!sem) {
      rejected.push({ candidate, reason: `Column "${candidate.column}" not found in semantic map` });
      continue;
    }

    // Reject if the column carries sensitive/PII data
    if (sem.isSensitive) {
      rejected.push({ candidate, reason: `Column "${candidate.column}" is sensitive/PII — excluded from KPIs` });
      continue;
    }

    // Reject columns that are too sparse to be useful as a KPI
    if (sem.nullRatio > MAX_NULL_RATIO_FOR_KPI) {
      rejected.push({ candidate, reason: `Column "${candidate.column}" has ${(sem.nullRatio * 100).toFixed(1)}% missing values — too sparse for a KPI` });
      continue;
    }

    valid.push(candidate);
  }

  return { valid, rejected };
};

/**
 * Validates chart candidates statistically.
 *
 * @param {Array<Object>} chartCandidates
 * @param {Map<string, Object>} columnSemantics
 * @returns {{ valid: Array<Object>, rejected: Array<Object> }}
 */
const validateChartCandidates = (chartCandidates, columnSemantics) => {
  const valid = [];
  const rejected = [];

  for (const candidate of chartCandidates) {
    const xSem = columnSemantics.get(candidate.xField);

    if (!xSem) {
      rejected.push({ candidate, reason: `X-axis column "${candidate.xField}" not found in semantic map` });
      continue;
    }

    // Reject charts where X-axis is sensitive/PII
    if (xSem.isSensitive) {
      rejected.push({ candidate, reason: `X-axis "${candidate.xField}" is a sensitive column — excluded from charts` });
      continue;
    }

    // Pie chart: reject if too many categories
    if (candidate.chartType === 'pie' && xSem.cardinalityCount > MAX_PIE_CATEGORIES) {
      rejected.push({
        candidate,
        reason: `Pie chart rejected: "${candidate.xField}" has ${xSem.cardinalityCount} categories (max ${MAX_PIE_CATEGORIES} for pie)`
      });
      continue;
    }

    // Bar/line chart: reject if non-temporal X-axis has too many categories
    if (['bar'].includes(candidate.chartType) &&
        !xSem.isTemporal &&
        xSem.cardinalityCount > MAX_CATEGORICAL_CARDINALITY) {
      rejected.push({
        candidate,
        reason: `Bar chart rejected: "${candidate.xField}" has ${xSem.cardinalityCount} categories (max ${MAX_CATEGORICAL_CARDINALITY} for categorical bar)`
      });
      continue;
    }

    valid.push(candidate);
  }

  return { valid, rejected };
};

module.exports = { validateKPICandidates, validateChartCandidates };
