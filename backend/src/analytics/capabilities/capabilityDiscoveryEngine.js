/**
 * Analytical Capability Discovery Engine
 *
 * Takes the relationship model and determines what types of analysis are
 * mathematically and statistically valid for this specific dataset.
 *
 * This runs BEFORE any candidate or intent generation.
 * It acts as a gatekeeper: no analytical intent is generated for a
 * capability that the dataset cannot support.
 *
 * Capabilities:
 *   TIME_SERIES        — requires: at least one temporal-measure relationship
 *   TREND_ANALYSIS     — requires: temporal + measure (trends/forecasts)
 *   BREAKDOWN          — requires: dimension (low/medium cardinality) + measure
 *   FREQUENCY          — requires: dimension + row count
 *   DISTRIBUTION       — requires: at least one numeric measure
 *   CORRELATION        — requires: >= 2 numeric measures (measure-measure pairs)
 *   ENTITY_COUNT       — requires: at least one identifier column
 *   PROPORTION         — requires: dimension with low/binary cardinality
 *   COMPARISON         — requires: >= 2 dimensions or temporal periods
 */

const CAPABILITIES = {
  TIME_SERIES: 'time_series',
  TREND_ANALYSIS: 'trend_analysis',
  BREAKDOWN: 'breakdown',
  FREQUENCY: 'frequency',
  DISTRIBUTION: 'distribution',
  CORRELATION: 'correlation',
  ENTITY_COUNT: 'entity_count',
  PROPORTION: 'proportion',
  COMPARISON: 'comparison'
};

/**
 * Discovers which analytical capabilities this dataset can support.
 *
 * @param {Object} relationshipModel - From buildRelationshipModel()
 * @param {Object} [domainContext]   - Optional { domain, confidence } advisory hint
 * @returns {Array<Object>} Sorted array of discovered capabilities (highest score first)
 */
const discoverCapabilities = (relationshipModel, domainContext = null) => {
  const caps = [];
  const {
    relationships,
    temporalColumns,
    measureColumns,
    dimensionColumns,
    identifierColumns,
    isMultiMeasure
  } = relationshipModel;

  // ─── TIME_SERIES ──────────────────────────────────────────────────────────
  const temporalMeasurePairs = relationships.filter(r => r.type === 'temporal-measure');
  if (temporalMeasurePairs.length > 0) {
    caps.push({
      capability: CAPABILITIES.TIME_SERIES,
      supportingRelationships: temporalMeasurePairs,
      score: Math.max(...temporalMeasurePairs.map(r => r.analyticalValue)),
      count: temporalMeasurePairs.length
    });
  }

  // ─── TREND_ANALYSIS ───────────────────────────────────────────────────────
  // Same data requirement as TIME_SERIES, but focuses on the top 2 pairs for forecasting
  if (temporalMeasurePairs.length > 0) {
    const topPairs = temporalMeasurePairs
      .sort((a, b) => b.analyticalValue - a.analyticalValue)
      .slice(0, 2);
    caps.push({
      capability: CAPABILITIES.TREND_ANALYSIS,
      supportingRelationships: topPairs,
      score: 78,
      count: topPairs.length
    });
  }

  // ─── BREAKDOWN ────────────────────────────────────────────────────────────
  // Only include dimension-measure pairs where the dimension is NOT high cardinality
  const breakdownRelationships = relationships.filter(r => {
    if (r.type !== 'dimension-measure') return false;
    const dim = dimensionColumns.find(d => d.column === r.xColumn);
    return dim && dim.cardinalityClass !== 'high';
  });
  if (breakdownRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.BREAKDOWN,
      supportingRelationships: breakdownRelationships,
      score: Math.max(...breakdownRelationships.map(r => r.analyticalValue)),
      count: breakdownRelationships.length
    });
  }

  // ─── FREQUENCY ────────────────────────────────────────────────────────────
  const frequencyRelationships = relationships.filter(r => r.type === 'dimension-count');
  if (frequencyRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.FREQUENCY,
      supportingRelationships: frequencyRelationships,
      score: Math.max(...frequencyRelationships.map(r => r.analyticalValue)),
      count: frequencyRelationships.length
    });
  }

  // ─── DISTRIBUTION ─────────────────────────────────────────────────────────
  if (measureColumns.length > 0) {
    const distRelationships = relationships.filter(r => r.type === 'measure-distribution');
    caps.push({
      capability: CAPABILITIES.DISTRIBUTION,
      supportingRelationships: distRelationships,
      score: 62,
      count: measureColumns.length
    });
  }

  // ─── CORRELATION ──────────────────────────────────────────────────────────
  const correlationPairs = relationships.filter(r => r.type === 'measure-measure');
  if (correlationPairs.length > 0) {
    caps.push({
      capability: CAPABILITIES.CORRELATION,
      supportingRelationships: correlationPairs,
      score: 68,
      count: correlationPairs.length
    });
  }

  // ─── ENTITY_COUNT ─────────────────────────────────────────────────────────
  const entityRelationships = relationships.filter(r => r.type === 'identifier-count');
  if (entityRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.ENTITY_COUNT,
      supportingRelationships: entityRelationships,
      score: 82,
      count: entityRelationships.length
    });
  }

  // ─── PROPORTION ───────────────────────────────────────────────────────────
  // Only low/binary cardinality dimensions are meaningful for proportional views
  const proportionDims = dimensionColumns.filter(d =>
    d.cardinalityClass === 'binary' || d.cardinalityClass === 'low'
  );
  if (proportionDims.length > 0) {
    const propRelationships = relationships.filter(r =>
      r.type === 'dimension-count' &&
      proportionDims.some(d => d.column === r.xColumn)
    );
    if (propRelationships.length > 0) {
      caps.push({
        capability: CAPABILITIES.PROPORTION,
        supportingRelationships: propRelationships,
        score: 75,
        count: propRelationships.length
      });
    }
  }

  // Sort by score descending so callers get the most valuable capabilities first
  return caps.sort((a, b) => b.score - a.score);
};

module.exports = { discoverCapabilities, CAPABILITIES };
