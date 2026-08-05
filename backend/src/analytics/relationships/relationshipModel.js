/**
 * Dataset Relationship Model
 *
 * Analyses the columnSemantics Map returned by semanticClassifier.classifyColumns()
 * and discovers the structural relationships between columns that can support
 * meaningful analysis.
 *
 * Relationship types:
 *   temporal-measure    — date column paired with numeric metric (time series, trend)
 *   dimension-measure   — categorical column paired with numeric metric (breakdown)
 *   measure-measure     — two numeric metrics (correlation, scatter)
 *   dimension-count     — categorical column paired with row count (frequency)
 *   temporal-count      — date column paired with row count (activity over time)
 *   measure-distribution — single numeric metric (distribution / histogram)
 *   identifier-count    — identifier column with count_distinct KPI
 *
 * Output is consumed by CapabilityDiscoveryEngine.
 */

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const computeTemporalMeasureValue = (tc, mc) => {
  let score = 85;
  if (mc.semanticRole === 'monetary_metric') score += 10;
  if (mc.semanticRole === 'additive_metric') score += 5;
  if (mc.nullRatio > 0.3) score -= 10;
  return Math.min(100, score);
};

const computeDimensionMeasureValue = (dc, mc) => {
  let score = 75;
  if (mc.isAdditive) score += 10;
  if (dc.cardinalityClass === 'low') score += 8;
  else if (dc.cardinalityClass === 'medium') score += 4;
  else if (dc.cardinalityClass === 'high') score -= 20; // too many categories for a useful breakdown
  if (mc.nullRatio > 0.3) score -= 8;
  return Math.max(0, Math.min(100, score));
};

const computeDimensionCountValue = (dc) => {
  let score = 68;
  if (dc.cardinalityClass === 'binary') score += 12;
  else if (dc.cardinalityClass === 'low') score += 8;
  else if (dc.cardinalityClass === 'medium') score += 4;
  else score -= 18; // high cardinality count charts are cluttered
  return Math.max(0, Math.min(100, score));
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Builds the relationship model for a dataset.
 *
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @returns {Object} Relationship model with column groups and relationship inventory
 */
const buildRelationshipModel = (columnSemantics) => {
  const temporalColumns = [];
  const measureColumns = [];
  const dimensionColumns = [];
  const identifierColumns = [];
  const ignoredColumns = [];

  for (const [colName, sem] of columnSemantics.entries()) {
    if (sem.isSensitive) {
      ignoredColumns.push({ column: colName, ...sem });
    } else if (sem.isIdentifier && !sem.isTemporal) {
      identifierColumns.push({ column: colName, ...sem });
    } else if (sem.isTemporal) {
      temporalColumns.push({ column: colName, ...sem });
    } else if (sem.isAggregatable) {
      measureColumns.push({ column: colName, ...sem });
    } else if (sem.isDimensionalizable) {
      dimensionColumns.push({ column: colName, ...sem });
    } else {
      ignoredColumns.push({ column: colName, ...sem });
    }
  }

  const relationships = [];

  // --- temporal-measure: every date × every measure ---
  for (const tc of temporalColumns) {
    for (const mc of measureColumns) {
      relationships.push({
        type: 'temporal-measure',
        xColumn: tc.column,
        yColumn: mc.column,
        xRole: tc.semanticRole,
        yRole: mc.semanticRole,
        analyticalValue: computeTemporalMeasureValue(tc, mc)
      });
    }
    // temporal-count: date × row count
    relationships.push({
      type: 'temporal-count',
      xColumn: tc.column,
      yColumn: '_count',
      xRole: tc.semanticRole,
      yRole: null,
      analyticalValue: 70
    });
  }

  // --- dimension-measure: every dimension × every measure ---
  for (const dc of dimensionColumns) {
    for (const mc of measureColumns) {
      relationships.push({
        type: 'dimension-measure',
        xColumn: dc.column,
        yColumn: mc.column,
        xRole: dc.semanticRole,
        yRole: mc.semanticRole,
        analyticalValue: computeDimensionMeasureValue(dc, mc)
      });
    }
    // dimension-count: dimension × frequency
    relationships.push({
      type: 'dimension-count',
      xColumn: dc.column,
      yColumn: '_count',
      xRole: dc.semanticRole,
      yRole: null,
      analyticalValue: computeDimensionCountValue(dc)
    });
  }

  // --- measure-measure: all pairs of numeric measures (for scatter/correlation) ---
  for (let i = 0; i < measureColumns.length; i++) {
    for (let j = i + 1; j < measureColumns.length; j++) {
      relationships.push({
        type: 'measure-measure',
        xColumn: measureColumns[i].column,
        yColumn: measureColumns[j].column,
        xRole: measureColumns[i].semanticRole,
        yRole: measureColumns[j].semanticRole,
        analyticalValue: 65
      });
    }
  }

  // --- measure-distribution: single measure alone (histogram) ---
  for (const mc of measureColumns) {
    relationships.push({
      type: 'measure-distribution',
      xColumn: mc.column,
      yColumn: null,
      xRole: mc.semanticRole,
      yRole: null,
      analyticalValue: 60
    });
  }

  // --- identifier-count: count_distinct of entity columns ---
  for (const ic of identifierColumns) {
    relationships.push({
      type: 'identifier-count',
      xColumn: ic.column,
      yColumn: null,
      xRole: ic.semanticRole,
      yRole: null,
      analyticalValue: 80
    });
  }

  return {
    temporalColumns,
    measureColumns,
    dimensionColumns,
    identifierColumns,
    ignoredColumns,
    relationships,
    // Summary flags used by CapabilityDiscoveryEngine
    hasTemporalDimension: temporalColumns.length > 0,
    hasMeasures: measureColumns.length > 0,
    hasDimensions: dimensionColumns.length > 0,
    hasIdentifiers: identifierColumns.length > 0,
    isMultiMeasure: measureColumns.length >= 2
  };
};

module.exports = { buildRelationshipModel };
