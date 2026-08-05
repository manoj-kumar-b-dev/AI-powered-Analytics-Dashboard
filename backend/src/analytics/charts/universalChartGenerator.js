/**
 * Universal Chart Generator
 *
 * Converts chart analytical intents into chart candidates ready for the
 * recommendation pipeline's validation, scoring, deduplication, and execution.
 *
 * Works for ANY dataset — no domain templates required.
 * Chart type is selected from the intent type and dimensional properties,
 * NOT from hardcoded domain template configs.
 *
 * Chart type selection rules (by intent type):
 *   time_series:             line (preferred) — shows trend
 *   categorical_breakdown:   bar — shows comparison across groups
 *   frequency_distribution:  bar (> 5 categories) | pie (≤ 5 categories)
 *   proportion:              pie (≤ 8 categories) | bar (otherwise)
 *   correlation:             scatter — shows relationship between two metrics
 */

const { INTENT_TYPES } = require('../intents/analyticalIntentGenerator');
const { validateAggregation } = require('../aggregation/aggregationRules');

// ---------------------------------------------------------------------------
// Chart type selection
// ---------------------------------------------------------------------------

/**
 * Selects the most appropriate chart type for the given intent and column semantics.
 *
 * @param {Object} intent
 * @param {Object|null} xSem - X-axis column semantics
 * @param {Object|null} ySem - Y-axis column semantics
 * @returns {string} chartType
 */
const selectChartType = (intent, xSem, ySem) => {
  // Always honour a preferred chart type specified by the intent
  if (intent.preferredChartType) return intent.preferredChartType;

  switch (intent.type) {
    case INTENT_TYPES.TIME_SERIES:
      return 'line';

    case INTENT_TYPES.CATEGORICAL_BREAKDOWN:
      return 'bar';

    case INTENT_TYPES.FREQUENCY_DISTRIBUTION:
      // Small number of categories → pie is readable; otherwise bar
      return (xSem && xSem.cardinalityCount > 0 && xSem.cardinalityCount <= 5) ? 'pie' : 'bar';

    case INTENT_TYPES.PROPORTION:
      // Pie only if cardinality is small enough
      return (xSem && xSem.cardinalityCount > 0 && xSem.cardinalityCount <= 8) ? 'pie' : 'bar';

    case INTENT_TYPES.CORRELATION:
      return 'scatter';

    default:
      return 'bar';
  }
};

// ---------------------------------------------------------------------------
// Title builder
// ---------------------------------------------------------------------------

const buildChartTitle = (intent) => {
  const xLabel = intent.xColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const yLabel = (intent.yColumn === '_count' || !intent.yColumn)
    ? 'Count'
    : intent.yColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  switch (intent.type) {
    case INTENT_TYPES.TIME_SERIES:
      return `${yLabel} Over Time`;
    case INTENT_TYPES.CATEGORICAL_BREAKDOWN:
      return `${yLabel} by ${xLabel}`;
    case INTENT_TYPES.FREQUENCY_DISTRIBUTION:
      return `${xLabel} Distribution`;
    case INTENT_TYPES.PROPORTION:
      return `${xLabel} Breakdown`;
    case INTENT_TYPES.CORRELATION:
      return `${xLabel} vs ${yLabel}`;
    default:
      return `${yLabel} by ${xLabel}`;
  }
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generates chart candidates from analytical intents.
 *
 * @param {Array<Object>} chartIntents    - From analyticalIntentGenerator.generateIntents()
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @returns {Array<Object>} Chart candidates ready for scoring and deduplication
 */
const generateUniversalChartCandidates = (chartIntents, columnSemantics) => {
  const candidates = [];

  for (const intent of chartIntents) {
    const xSem = columnSemantics.get(intent.xColumn);
    const ySem = (intent.yColumn && intent.yColumn !== '_count')
      ? columnSemantics.get(intent.yColumn)
      : null;

    // Validate Y-axis aggregation if Y is a real column (not _count)
    let aggregation = intent.aggregation;
    if (ySem && aggregation !== 'none') {
      const validation = validateAggregation(ySem.semanticRole, aggregation);
      if (!validation.valid) {
        if (!validation.suggestedAggregation) continue; // no valid agg — skip chart
        aggregation = validation.suggestedAggregation;
        // Remap group_by / trend aggregations to count for chart execution
        if (aggregation === 'group_by' || aggregation === 'trend' || aggregation === 'date_grouping') {
          aggregation = 'count';
        }
      }
    }

    const chartType = selectChartType(intent, xSem, ySem);
    const title = buildChartTitle(intent);

    candidates.push({
      // Identity
      id: `chart-universal-${intent.xColumn}-${intent.yColumn || 'count'}-${aggregation}`,
      title,

      // Fields
      chartType,
      xField: intent.xColumn,
      yField: intent.yColumn || '_count',
      aggregation,

      // Semantic metadata
      xSemanticRole: xSem?.semanticRole || null,
      ySemanticRole: ySem?.semanticRole || null,
      intentType: intent.type,

      // Scoring inputs
      priority: intent.priority,
      domainRelevance: intent.analyticalValue,    // analyticalValue replaces domain template score
      analyticalValue: intent.analyticalValue,
      businessReason: intent.businessReason,
      source: 'universal'
    });
  }

  return candidates;
};

module.exports = { generateUniversalChartCandidates };
