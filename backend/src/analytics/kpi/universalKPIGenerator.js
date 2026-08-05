/**
 * Universal KPI Generator
 *
 * Converts KPI analytical intents into KPI candidates ready for the
 * recommendation pipeline's scoring, deduplication, and execution stages.
 *
 * Works for ANY dataset — no domain templates required.
 * Output format matches what recommendationPipeline.js and
 * analyticsService.calculateKPIs() expect.
 *
 * Every candidate produced here is guaranteed to:
 *   - Reference a column that exists in columnSemantics
 *   - Use a semantically valid aggregation (validated against aggregationRules)
 *   - Carry an analyticalValue score derived from data structure (not domain template)
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { validateAggregation } = require('../aggregation/aggregationRules');

// ---------------------------------------------------------------------------
// Display metadata maps (domain-neutral)
// ---------------------------------------------------------------------------

const ROLE_FORMAT_MAP = {
  [SEMANTIC_ROLES.MONETARY_METRIC]:    { format: 'currency', icon: 'IndianRupee', color: 'purple' },
  [SEMANTIC_ROLES.ADDITIVE_METRIC]:    { format: 'number',   icon: 'Activity',    color: 'blue'   },
  [SEMANTIC_ROLES.PERCENTAGE_METRIC]:  { format: 'percent',  icon: 'Percent',     color: 'emerald'},
  [SEMANTIC_ROLES.RATIO_METRIC]:       { format: 'percent',  icon: 'Percent',     color: 'cyan'   },
  [SEMANTIC_ROLES.ORDINAL_METRIC]:     { format: 'number',   icon: 'Star',        color: 'amber'  },
  [SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]: { format: 'number', icon: 'Users',      color: 'indigo' },
  [SEMANTIC_ROLES.NON_ADDITIVE_METRIC]:{ format: 'number',   icon: 'Activity',    color: 'blue'   },
  [SEMANTIC_ROLES.IDENTIFIER]:         { format: 'number',   icon: 'Hash',        color: 'slate'  },
  DEFAULT:                             { format: 'number',   icon: 'Activity',    color: 'blue'   }
};

// ---------------------------------------------------------------------------
// Title builder
// ---------------------------------------------------------------------------

const buildKPITitle = (colName, aggregation) => {
  const label = colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const agg = (aggregation || '').toLowerCase();
  if (agg === 'count' || agg === 'count_distinct') return `Total ${label}`;
  if (agg === 'sum') return `Total ${label}`;
  if (agg === 'avg') return `Average ${label}`;
  if (agg === 'max') return `Maximum ${label}`;
  if (agg === 'min') return `Minimum ${label}`;
  return `${label} Overview`;
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generates KPI candidates from analytical intents.
 *
 * @param {Array<Object>} kpiIntents      - From analyticalIntentGenerator.generateIntents()
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @returns {Array<Object>} KPI candidates ready for scoring and deduplication
 */
const generateUniversalKPICandidates = (kpiIntents, columnSemantics) => {
  const candidates = [];

  for (const intent of kpiIntents) {
    const sem = columnSemantics.get(intent.column);
    if (!sem) continue;

    // Validate aggregation against semantic role — fix or skip invalid ones
    let aggregation = intent.aggregation;
    const validation = validateAggregation(sem.semanticRole, aggregation);
    if (!validation.valid) {
      if (!validation.suggestedAggregation) {
        // No valid aggregation exists for this role — skip candidate
        continue;
      }
      aggregation = validation.suggestedAggregation;
    }

    const display = ROLE_FORMAT_MAP[sem.semanticRole] || ROLE_FORMAT_MAP.DEFAULT;

    candidates.push({
      // Identity
      id: `kpi-universal-${intent.column}-${aggregation}`,
      kpi: `${intent.column}_${aggregation}`,   // unique KPI key used by analyticsService
      column: intent.column,
      title: buildKPITitle(intent.column, aggregation),

      // Aggregation (semantically validated)
      aggregation,

      // Display metadata
      label: buildKPITitle(intent.column, aggregation),
      format: display.format,
      icon: display.icon,
      color: display.color,

      // Scoring inputs (replace domain-template hardcoded values)
      semanticRole: sem.semanticRole,
      priority: intent.priority,
      domainRelevance: intent.analyticalValue,   // analyticalValue replaces the domain template score
      analyticalValue: intent.analyticalValue,
      businessReason: intent.businessReason,
      source: 'universal'
    });
  }

  return candidates;
};

module.exports = { generateUniversalKPICandidates };
