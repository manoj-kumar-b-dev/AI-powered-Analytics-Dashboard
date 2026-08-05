# Universal Analytics Implementation Plan

**Project:** AI-powered SaaS Analytics Dashboard  
**Status:** Phase 2 — Implementation Plan (Awaiting Execution)  
**Based on Audit:** `UNIVERSAL_ANALYTICS_ARCHITECTURE_AUDIT.md`  
**Plan Date:** 2026-07-14

---

## Guiding Principles

Before reading individual steps, internalize these constraints:

1. **Do NOT rewrite the entire project.** Modify existing files surgically.  
2. **Do NOT redesign the UI.** Frontend components are render-only — only fix analytics violations.  
3. **Do NOT redesign authentication, multi-tenancy, or routing.** These are out of scope.  
4. **Maintain backward compatibility.** The dashboard API response shape must remain identical.  
5. **The LLM must NEVER calculate values.** It may resolve ambiguity, suggest column names, and generate insights from pre-computed values.  
6. **Domain classification remains.** It becomes optional context, not a controller.  
7. **Each step must be independently executable and testable.** No step depends on code from a future step.

---

## Step Overview

| Step | Name | Risk | Effort | Files Changed |
|------|------|------|--------|---------------|
| 1 | Remove Dead Code | Very Low | Small | Delete 12 files |
| 2 | Strengthen Semantic Profiling | Low | Medium | Modify 2 files |
| 3 | Dataset Relationship Modeling | Low | Medium | Create 1 file |
| 4 | Analytical Capability Discovery | Medium | Medium | Create 1 file |
| 5 | Analytical Intent Generation | Medium | Large | Create 1 file |
| 6 | Universal KPI Candidate Generation | High | Large | Modify 2, Create 1 |
| 7 | Universal Chart Candidate Generation | High | Large | Modify 2, Create 1 |
| 8 | Statistical + Result Validation | Medium | Medium | Create 2 files, Modify 2 |
| 9 | Analytical Utility Scoring | Medium | Medium | Rewrite 1 file |
| 10 | Diversity Optimization | Low | Small | Modify 1 file |
| 11 | Temporal Intelligence | Medium | Medium | Create 1 file, Modify 1 |
| 12 | Fix Filter Regeneration Bug | High | Small | Modify 2 files |
| 13 | Move Frontend Analytics to Backend | High | Medium | Create 1 endpoint, Modify 3 frontend |
| 14 | Demote Domain to Optional Context | High | Small | Modify 3 files |

---

## Step 1 — Remove Dead Code

**Risk:** Very Low  
**Rationale:** Eliminate confusion about the active code path before any architectural work begins.

### Files to Delete

```
backend/src/services/ai/aiService.js
backend/src/services/ai/kpiRecommendationEngine.js
backend/src/services/ai/chartRecommendationEngine.js
backend/src/services/ai/columnRoleDetector.js
backend/src/services/ai/datasetClassifier.js
backend/src/services/ai/geminiClient.js
backend/src/services/ai/insightGenerator.js
backend/src/services/ai/promptBuilder.js
backend/src/services/ai/responseParser.js
backend/src/services/ai/retryHandler.js
backend/src/services/ai/schemaValidator.js
backend/src/services/dashboard/dashboardGenerator.js
backend/test-err.js
backend/test-mapping.js
backend/test_gemini_recs.js
```

### Before Deleting: Import Audit

Run a grep to confirm none of these files are imported in the active pipeline:

```bash
grep -r "services/ai/" backend/src/services/analyticsService.js
grep -r "services/ai/" backend/src/routes/
grep -r "services/ai/" backend/src/controllers/
grep -r "llmClient" backend/src/
grep -r "dashboardGenerator" backend/src/
```

Expected result: Zero hits in any active route, controller, or service.

### Action

Delete the files listed above. Do NOT delete:
- `backend/src/services/ai/llmClient.js` — leave in place (contains multi-provider dispatch, may be useful)
- `backend/src/config/gemini.js` — active pipeline depends on this
- `backend/src/services/insightGenerator/insightGeneratorService.js` — active

### Verification

```bash
cd backend && npm run dev
# Server must start without errors
# No "Cannot find module" errors
```

---

## Step 2 — Strengthen Semantic Profiling

**Risk:** Low  
**Rationale:** The semantic classifier currently uses only column name regex and cardinality. The Universal Semantic Model needs statistical properties to power capability discovery and intent generation.

### Target: Enhanced Schema Column Object

Every column in the semantic model needs these additional fields computed during classification:

```javascript
{
  column: "salary",
  type: "numeric",           // from parserService (existing)
  detectedType: "Number",    // from parserService (existing)
  sampleValues: [...],       // from parserService (existing)
  
  // NEW — Statistical Profile (computed from DataRow or schema stats)
  nullRatio: 0.03,           // fraction of rows with null/empty value
  uniqueRatio: 0.95,         // fraction of unique values / total rows
  cardinalityClass: "high",  // "binary" (2), "low" (<10), "medium" (<50), "high" (>=50)
  cardinalityCount: 147,     // exact count of distinct values (from schema or sample)
  
  // NEW — Semantic Classification (enhanced output from semanticClassifier)
  semanticRole: "monetary_metric",
  semanticConfidence: 0.92,
  semanticReason: "Name matches monetary pattern; numeric type; not identifier",
  
  // NEW — Analytical Properties (derived from above)
  isAdditive: true,          // can SUM meaningfully
  isAggregatable: true,      // can be Y-axis of a chart
  isDimensionalizable: false, // can be X-axis / GROUP BY axis
  isTemporal: false,         // is a time dimension
  isIdentifier: false,       // must never be aggregated
  isSensitive: false         // PII or sensitive data
}
```

### 2.1 — Modify `parserService.js`

**File:** `backend/src/services/parserService.js`

Modify `inferSchema()` to compute and attach statistical properties:

```javascript
// After collecting `values` array for each column, add:

// Null ratio
const nullRatio = (totalRows - values.length) / Math.max(totalRows, 1);

// Unique ratio and cardinality
const uniqueValues = new Set(values);
const cardinalityCount = uniqueValues.size;
const uniqueRatio = cardinalityCount / Math.max(values.length, 1);

// Cardinality class
let cardinalityClass;
if (cardinalityCount <= 2) cardinalityClass = 'binary';
else if (cardinalityCount <= 10) cardinalityClass = 'low';
else if (cardinalityCount < 50) cardinalityClass = 'medium';
else cardinalityClass = 'high';

// Push to schema:
schema.push({
  column: col,
  type: inferredType,
  detectedType: detectedType,
  nullable: values.length < totalRows,
  sampleValues: distinctSamples.map(v => v.toString()),
  nullRatio: parseFloat(nullRatio.toFixed(4)),
  uniqueRatio: parseFloat(uniqueRatio.toFixed(4)),
  cardinalityCount,
  cardinalityClass
});
```

**What changes:** `inferSchema()` return objects gain `nullRatio`, `uniqueRatio`, `cardinalityCount`, `cardinalityClass`.

**What does NOT change:** The `inferredType` logic, `validateRows()`, `parseUploadedFile()` interface.

### 2.2 — Modify `semanticClassifier.js`

**File:** `backend/src/analytics/semantic/semanticClassifier.js`

Modify `classifyColumns(schema)` to use the new stats fields in classification decisions and return them in the output:

```javascript
// In classifyColumns(), for each column, after classifyColumn():

const colStats = col; // col now has nullRatio, uniqueRatio, cardinalityCount, cardinalityClass

// Derive analytical properties from semantic role + stats
const isIdentifier = result.semanticRole === SEMANTIC_ROLES.IDENTIFIER || 
                     result.semanticRole === SEMANTIC_ROLES.CONTACT_INFORMATION ||
                     result.semanticRole === SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE;

const isAdditive = [
  SEMANTIC_ROLES.MONETARY_METRIC,
  SEMANTIC_ROLES.ADDITIVE_METRIC
].includes(result.semanticRole);

const isAggregatable = !isIdentifier && col.type === 'numeric';

const isDimensionalizable = (
  col.type === 'categorical' || 
  col.type === 'boolean' ||
  result.semanticRole === SEMANTIC_ROLES.STATUS_DIMENSION ||
  result.semanticRole === SEMANTIC_ROLES.CATEGORICAL_DIMENSION ||
  result.semanticRole === SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION ||
  (col.cardinalityClass === 'low' || col.cardinalityClass === 'medium' || col.cardinalityClass === 'binary')
);

const isTemporal = result.semanticRole === SEMANTIC_ROLES.TEMPORAL_DIMENSION || col.type === 'date';

// Attach to result map
columnSemantics.set(col.column, {
  ...result,
  // Stats passthrough
  nullRatio: col.nullRatio || 0,
  uniqueRatio: col.uniqueRatio || 1,
  cardinalityCount: col.cardinalityCount || 0,
  cardinalityClass: col.cardinalityClass || 'high',
  // Analytical flags
  isAdditive,
  isAggregatable,
  isDimensionalizable,
  isTemporal,
  isIdentifier,
  isSensitive: result.semanticRole === SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE
});
```

**Also use stats in classification (enhance `classifyColumn`):**

- If `cardinalityClass === 'binary'` → strongly prefer `STATUS_DIMENSION`
- If `cardinalityClass === 'high'` AND `type === 'text'` → prefer `TEXT_ATTRIBUTE` over `CATEGORICAL_DIMENSION`
- If `uniqueRatio > 0.95` AND `type === 'numeric'` → boost probability of `IDENTIFIER`
- If `uniqueRatio > 0.95` AND `type === 'text'` → prefer `IDENTIFIER` over `TEXT_ATTRIBUTE`

### Verification

```javascript
// Test in backend/tests/semanticClassifier.test.js (extend existing)
const schema = [
  { column: 'salary', type: 'numeric', sampleValues: ['50000', '60000'], nullRatio: 0.02, cardinalityCount: 145, cardinalityClass: 'high', uniqueRatio: 0.90 }
];
const result = classifyColumns(schema).get('salary');
assert(result.isAdditive === true);
assert(result.isDimensionalizable === false);
assert(result.isIdentifier === false);
```

---

## Step 3 — Dataset Relationship Modeling

**Risk:** Low  
**Rationale:** Before generating candidates, the system must understand structural relationships between columns — specifically which columns can be paired for meaningful analysis.

### New File: `backend/src/analytics/relationships/relationshipModel.js`

**Purpose:** Analyzes the `columnSemantics` Map and returns a structured relationship inventory.

```javascript
/**
 * Dataset Relationship Model
 *
 * Discovers analytical relationships between columns in a dataset.
 * Outputs a structured set of relationship groups used by 
 * CapabilityDiscoveryEngine to determine what analysis is possible.
 *
 * Relationship types:
 *   temporal-measure:    date column → numeric metric (time series, trend)
 *   dimension-measure:   categorical column → numeric metric (breakdown, distribution)
 *   measure-measure:     numeric → numeric (correlation, scatter)
 *   dimension-count:     categorical column → row count (frequency)
 *   temporal-count:      date column → row count (activity over time)
 *   measure-distribution: numeric column alone (distribution / histogram)
 *   identifier-count:   identifier column → count_distinct
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');

/**
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @returns {Object} Relationship inventory
 */
const buildRelationshipModel = (columnSemantics) => {
  const temporalColumns = [];
  const measureColumns = [];
  const dimensionColumns = [];
  const identifierColumns = [];
  const ignoredColumns = [];

  for (const [colName, sem] of columnSemantics.entries()) {
    if (sem.isIdentifier || sem.isSensitive) {
      ignoredColumns.push(colName);
    } else if (sem.isTemporal) {
      temporalColumns.push({ column: colName, ...sem });
    } else if (sem.isAggregatable) {
      measureColumns.push({ column: colName, ...sem });
    } else if (sem.isDimensionalizable) {
      dimensionColumns.push({ column: colName, ...sem });
    }
  }

  const relationships = [];

  // temporal-measure: every date × every measure
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

  // dimension-measure: every dimension × every measure
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

  // measure-measure: every pair of measures (for scatter/correlation)
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

  // measure-distribution: single measure (histogram)
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

  // identifier-count: distinct count of entities
  for (const [colName, sem] of columnSemantics.entries()) {
    if (sem.semanticRole === SEMANTIC_ROLES.IDENTIFIER) {
      relationships.push({
        type: 'identifier-count',
        xColumn: colName,
        yColumn: null,
        xRole: SEMANTIC_ROLES.IDENTIFIER,
        yRole: null,
        analyticalValue: 80
      });
    }
  }

  return {
    temporalColumns,
    measureColumns,
    dimensionColumns,
    identifierColumns,
    ignoredColumns,
    relationships,
    hasTemporalDimension: temporalColumns.length > 0,
    hasMeasures: measureColumns.length > 0,
    hasDimensions: dimensionColumns.length > 0,
    isMultiMeasure: measureColumns.length >= 2
  };
};

// Scoring helpers
const computeTemporalMeasureValue = (tc, mc) => {
  let score = 85;
  if (mc.semanticRole === 'monetary_metric') score += 10;
  if (mc.semanticRole === 'additive_metric') score += 5;
  return Math.min(100, score);
};

const computeDimensionMeasureValue = (dc, mc) => {
  let score = 75;
  if (mc.isAdditive) score += 10;
  if (dc.cardinalityClass === 'low') score += 8;
  if (dc.cardinalityClass === 'medium') score += 4;
  if (dc.cardinalityClass === 'high') score -= 15; // too many categories
  return Math.max(0, Math.min(100, score));
};

const computeDimensionCountValue = (dc) => {
  let score = 70;
  if (dc.cardinalityClass === 'low') score += 10;
  if (dc.cardinalityClass === 'medium') score += 5;
  if (dc.cardinalityClass === 'high') score -= 20;
  return Math.max(0, Math.min(100, score));
};

module.exports = { buildRelationshipModel };
```

### Verification

```javascript
// Unit test: given HR schema, should find temporal-measure, dimension-measure relationships
const model = buildRelationshipModel(columnSemantics);
assert(model.hasTemporalDimension === true);
assert(model.relationships.some(r => r.type === 'temporal-measure'));
assert(model.relationships.some(r => r.type === 'dimension-measure'));
```

---

## Step 4 — Analytical Capability Discovery

**Risk:** Medium  
**Rationale:** The system must know what analysis is *possible* before asking what analysis is *wanted*.

### New File: `backend/src/analytics/capabilities/capabilityDiscoveryEngine.js`

**Purpose:** Takes the relationship model and returns a structured set of analytical capabilities — what the dataset can meaningfully support.

```javascript
/**
 * Analytical Capability Discovery Engine
 *
 * Determines what types of analysis are mathematically and statistically
 * valid for this specific dataset, based on its structure.
 *
 * Capabilities:
 *   TIME_SERIES        - requires: temporal + measure
 *   TREND_ANALYSIS     - requires: temporal + measure + >= 3 temporal groups
 *   BREAKDOWN          - requires: dimension (low/medium cardinality) + measure
 *   FREQUENCY          - requires: dimension + row count
 *   DISTRIBUTION       - requires: numeric measure
 *   CORRELATION        - requires: >= 2 numeric measures
 *   ENTITY_COUNT       - requires: identifier column
 *   PROPORTION         - requires: dimension with low cardinality
 *   COMPARISON         - requires: >= 2 dimensions or temporal periods
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
 * @param {Object} relationshipModel - From buildRelationshipModel()
 * @param {Object} [domainContext] - Optional domain hint (advisory only)
 * @returns {Array<Object>} Array of discovered capabilities with metadata
 */
const discoverCapabilities = (relationshipModel, domainContext = null) => {
  const caps = [];
  const { relationships, temporalColumns, measureColumns, dimensionColumns } = relationshipModel;

  // TIME_SERIES: temporal + measure pairs
  const temporalMeasurePairs = relationships.filter(r => r.type === 'temporal-measure');
  if (temporalMeasurePairs.length > 0) {
    caps.push({
      capability: CAPABILITIES.TIME_SERIES,
      supportingRelationships: temporalMeasurePairs,
      score: Math.max(...temporalMeasurePairs.map(r => r.analyticalValue)),
      count: temporalMeasurePairs.length
    });
  }

  // TREND_ANALYSIS: time series capability + sufficient data (checked at execution)
  if (temporalMeasurePairs.length > 0) {
    caps.push({
      capability: CAPABILITIES.TREND_ANALYSIS,
      supportingRelationships: temporalMeasurePairs.slice(0, 2),
      score: 78,
      count: temporalMeasurePairs.length
    });
  }

  // BREAKDOWN: dimension + measure (low/medium cardinality dimensions only)
  const breakdownRelationships = relationships.filter(r =>
    r.type === 'dimension-measure' &&
    relationshipModel.dimensionColumns.find(d => d.column === r.xColumn)?.cardinalityClass !== 'high'
  );
  if (breakdownRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.BREAKDOWN,
      supportingRelationships: breakdownRelationships,
      score: Math.max(...breakdownRelationships.map(r => r.analyticalValue)),
      count: breakdownRelationships.length
    });
  }

  // FREQUENCY: dimension + count
  const frequencyRelationships = relationships.filter(r => r.type === 'dimension-count');
  if (frequencyRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.FREQUENCY,
      supportingRelationships: frequencyRelationships,
      score: 72,
      count: frequencyRelationships.length
    });
  }

  // DISTRIBUTION: any numeric measure
  if (measureColumns.length > 0) {
    const distRelationships = relationships.filter(r => r.type === 'measure-distribution');
    caps.push({
      capability: CAPABILITIES.DISTRIBUTION,
      supportingRelationships: distRelationships,
      score: 65,
      count: measureColumns.length
    });
  }

  // CORRELATION: two or more numeric measures
  const correlationPairs = relationships.filter(r => r.type === 'measure-measure');
  if (correlationPairs.length > 0) {
    caps.push({
      capability: CAPABILITIES.CORRELATION,
      supportingRelationships: correlationPairs,
      score: 70,
      count: correlationPairs.length
    });
  }

  // ENTITY_COUNT: identifier columns
  const entityRelationships = relationships.filter(r => r.type === 'identifier-count');
  if (entityRelationships.length > 0) {
    caps.push({
      capability: CAPABILITIES.ENTITY_COUNT,
      supportingRelationships: entityRelationships,
      score: 80,
      count: entityRelationships.length
    });
  }

  // PROPORTION: low-cardinality dimension for pie/donut
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

  return caps.sort((a, b) => b.score - a.score);
};

module.exports = { discoverCapabilities, CAPABILITIES };
```

---

## Step 5 — Analytical Intent Generation

**Risk:** Medium  
**Rationale:** Intents are the analytical questions the system should answer. They are derived from capabilities + relationships, not from domain templates.

### New File: `backend/src/analytics/intents/analyticalIntentGenerator.js`

**Purpose:** Converts capabilities into concrete, actionable analytical intents. Each intent maps 1:1 to a KPI card or chart.

```javascript
/**
 * Analytical Intent Generator
 *
 * Converts discovered capabilities into concrete analytical intents.
 * Each intent represents a specific analytical question with:
 *   - The columns involved
 *   - The aggregation method
 *   - The visualization type
 *   - A priority score
 *   - A business reason
 *
 * Intents are then passed to the Universal Candidate Generators.
 *
 * Intent types:
 *   KPI_AGGREGATE      → "What is the total/avg/count of [metric]?"
 *   KPI_ENTITY_COUNT   → "How many unique [entities] are there?"
 *   TIME_SERIES        → "How has [metric] changed over time?"
 *   CATEGORICAL_BREAKDOWN → "How does [metric] differ by [dimension]?"
 *   DISTRIBUTION       → "What is the distribution of [metric]?"
 *   PROPORTION         → "What is the composition of [dimension]?"
 *   CORRELATION        → "Is there a relationship between [metric1] and [metric2]?"
 */

const { CAPABILITIES } = require('../capabilities/capabilityDiscoveryEngine');
const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { getPreferredAggregation } = require('../aggregation/aggregationRules');

const INTENT_TYPES = {
  KPI_AGGREGATE: 'kpi_aggregate',
  KPI_ENTITY_COUNT: 'kpi_entity_count',
  TIME_SERIES: 'time_series',
  CATEGORICAL_BREAKDOWN: 'categorical_breakdown',
  FREQUENCY_DISTRIBUTION: 'frequency_distribution',
  PROPORTION: 'proportion',
  CORRELATION: 'correlation'
};

/**
 * @param {Array<Object>} capabilities - From discoverCapabilities()
 * @param {Map<string, Object>} columnSemantics - From classifyColumns()
 * @param {Object} [domainContext] - Optional domain hint { domain, confidence }
 * @returns {{ kpiIntents: Array, chartIntents: Array }}
 */
const generateIntents = (capabilities, columnSemantics, domainContext = null) => {
  const kpiIntents = [];
  const chartIntents = [];

  const capMap = new Map(capabilities.map(c => [c.capability, c]));

  // ── KPI INTENTS ──────────────────────────────────────────────────────────

  // KPI_AGGREGATE: one KPI per measure column (top 6 by analytical value)
  for (const [colName, sem] of columnSemantics.entries()) {
    if (!sem.isAggregatable || sem.isIdentifier || sem.isSensitive) continue;
    const preferredAgg = getPreferredAggregation(sem.semanticRole);
    kpiIntents.push({
      type: INTENT_TYPES.KPI_AGGREGATE,
      column: colName,
      aggregation: preferredAgg,
      semanticRole: sem.semanticRole,
      priority: sem.semanticRole === SEMANTIC_ROLES.MONETARY_METRIC ? 'primary' : 'secondary',
      analyticalValue: computeKPIValue(sem),
      businessReason: `Aggregate ${preferredAgg.toUpperCase()} of ${colName} provides a key dataset metric`
    });
  }

  // KPI_ENTITY_COUNT: count_distinct for each identifier column
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
        businessReason: `Distinct count of ${rel.xColumn} measures the number of unique entities`
      });
    }
  }

  // ── CHART INTENTS ─────────────────────────────────────────────────────────

  // TIME_SERIES: for each temporal-measure relationship
  const timeSeriesCap = capMap.get(CAPABILITIES.TIME_SERIES);
  if (timeSeriesCap) {
    for (const rel of timeSeriesCap.supportingRelationships) {
      const sem = columnSemantics.get(rel.yColumn);
      chartIntents.push({
        type: INTENT_TYPES.TIME_SERIES,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: sem ? getPreferredAggregation(sem.semanticRole) : 'sum',
        preferredChartType: 'line',
        priority: rel.analyticalValue >= 90 ? 'primary' : 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Track how ${rel.yColumn} changes over time`
      });
    }
  }

  // CATEGORICAL_BREAKDOWN: dimension × measure
  const breakdownCap = capMap.get(CAPABILITIES.BREAKDOWN);
  if (breakdownCap) {
    for (const rel of breakdownCap.supportingRelationships) {
      const sem = columnSemantics.get(rel.yColumn);
      const dimSem = columnSemantics.get(rel.xColumn);
      chartIntents.push({
        type: INTENT_TYPES.CATEGORICAL_BREAKDOWN,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: sem ? getPreferredAggregation(sem.semanticRole) : 'sum',
        preferredChartType: dimSem?.cardinalityClass === 'low' ? 'bar' : 'bar',
        priority: rel.analyticalValue >= 80 ? 'primary' : 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Compare ${rel.yColumn} across different ${rel.xColumn} groups`
      });
    }
  }

  // FREQUENCY_DISTRIBUTION: dimension × count
  const freqCap = capMap.get(CAPABILITIES.FREQUENCY);
  if (freqCap) {
    for (const rel of freqCap.supportingRelationships) {
      const dimSem = columnSemantics.get(rel.xColumn);
      chartIntents.push({
        type: INTENT_TYPES.FREQUENCY_DISTRIBUTION,
        xColumn: rel.xColumn,
        yColumn: '_count',
        aggregation: 'count',
        preferredChartType: 'bar',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Show frequency distribution of ${rel.xColumn}`
      });
    }
  }

  // PROPORTION: low-cardinality dimension
  const proportionCap = capMap.get(CAPABILITIES.PROPORTION);
  if (proportionCap) {
    for (const rel of proportionCap.supportingRelationships) {
      chartIntents.push({
        type: INTENT_TYPES.PROPORTION,
        xColumn: rel.xColumn,
        yColumn: '_count',
        aggregation: 'count',
        preferredChartType: 'pie',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Show proportional breakdown of ${rel.xColumn}`
      });
    }
  }

  // CORRELATION: measure × measure (scatter)
  const corrCap = capMap.get(CAPABILITIES.CORRELATION);
  if (corrCap) {
    // Only top 2 correlation pairs to avoid chart overload
    for (const rel of corrCap.supportingRelationships.slice(0, 2)) {
      chartIntents.push({
        type: INTENT_TYPES.CORRELATION,
        xColumn: rel.xColumn,
        yColumn: rel.yColumn,
        aggregation: 'none',
        preferredChartType: 'scatter',
        priority: 'secondary',
        analyticalValue: rel.analyticalValue,
        businessReason: `Explore relationship between ${rel.xColumn} and ${rel.yColumn}`
      });
    }
  }

  return { kpiIntents, chartIntents };
};

// Scoring
const computeKPIValue = (sem) => {
  const BASE = {
    monetary_metric: 95,
    additive_metric: 85,
    percentage_metric: 75,
    ordinal_metric: 70,
    ratio_metric: 70,
    non_additive_metric: 60,
    demographic_attribute: 65,
    unknown: 40
  };
  return BASE[sem.semanticRole] || 50;
};

module.exports = { generateIntents, INTENT_TYPES };
```

---

## Step 6 — Universal KPI Candidate Generation

**Risk:** High  
**Rationale:** This replaces the domain-template path for KPI candidates. The new generator creates candidates from analytical intents rather than domain templates.

### 6.1 — Create `backend/src/analytics/kpi/universalKPIGenerator.js`

**Purpose:** Converts KPI intents into KPI candidates using the same structure that `validateExternalKPICandidate()` expects.

```javascript
/**
 * Universal KPI Generator
 *
 * Generates KPI candidates from analytical intents.
 * These are NOT domain-specific — they work for any dataset.
 *
 * Output format matches the structure consumed by recommendationPipeline.js
 * and ultimately by analyticsService.calculateKPIs().
 */

const { AGGREGATIONS, validateAggregation } = require('../aggregation/aggregationRules');
const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');

const ROLE_FORMAT_MAP = {
  [SEMANTIC_ROLES.MONETARY_METRIC]: { format: 'currency', icon: 'DollarSign', color: 'purple' },
  [SEMANTIC_ROLES.PERCENTAGE_METRIC]: { format: 'percent', icon: 'Percent', color: 'emerald' },
  [SEMANTIC_ROLES.RATIO_METRIC]: { format: 'percent', icon: 'Percent', color: 'blue' },
  [SEMANTIC_ROLES.ORDINAL_METRIC]: { format: 'number', icon: 'Star', color: 'amber' },
  [SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]: { format: 'number', icon: 'Users', color: 'cyan' },
  [SEMANTIC_ROLES.ADDITIVE_METRIC]: { format: 'number', icon: 'Activity', color: 'blue' },
  [SEMANTIC_ROLES.IDENTIFIER]: { format: 'number', icon: 'Hash', color: 'indigo' },
  DEFAULT: { format: 'number', icon: 'Activity', color: 'blue' }
};

/**
 * @param {Array<Object>} kpiIntents - From generateIntents()
 * @param {Map<string, Object>} columnSemantics - From classifyColumns()
 * @returns {Array<Object>} KPI candidates
 */
const generateUniversalKPICandidates = (kpiIntents, columnSemantics) => {
  const candidates = [];

  for (const intent of kpiIntents) {
    const sem = columnSemantics.get(intent.column);
    if (!sem) continue;

    // Validate aggregation
    const validation = validateAggregation(sem.semanticRole, intent.aggregation);
    if (!validation.valid) {
      const fixedAgg = validation.suggestedAggregation;
      if (!fixedAgg) continue; // no valid aggregation exists — skip
      intent.aggregation = fixedAgg;
    }

    const display = ROLE_FORMAT_MAP[sem.semanticRole] || ROLE_FORMAT_MAP.DEFAULT;
    const colNameFormatted = intent.column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    candidates.push({
      id: `kpi-${intent.column}-${intent.aggregation}`,
      column: intent.column,
      title: buildKPITitle(intent, colNameFormatted),
      aggregation: intent.aggregation,
      format: display.format,
      icon: display.icon,
      color: display.color,
      semanticRole: sem.semanticRole,
      priority: intent.priority,
      domainRelevance: intent.analyticalValue,   // replaces hardcoded domain score
      analyticalValue: intent.analyticalValue,
      businessReason: intent.businessReason,
      source: 'universal'
    });
  }

  return candidates;
};

const buildKPITitle = (intent, colNameFormatted) => {
  const agg = (intent.aggregation || '').toLowerCase();
  if (agg === 'count' || agg === 'count_distinct') return `Total ${colNameFormatted}`;
  if (agg === 'avg') return `Average ${colNameFormatted}`;
  if (agg === 'sum') return `Total ${colNameFormatted}`;
  if (agg === 'max') return `Maximum ${colNameFormatted}`;
  if (agg === 'min') return `Minimum ${colNameFormatted}`;
  return `${colNameFormatted} Overview`;
};

module.exports = { generateUniversalKPICandidates };
```

### 6.2 — Modify `recommendationPipeline.js`

**Change:** Add a universal generation path that runs before the domain-template path. Domain templates become a supplement (not primary source) during the transition, and are eventually removed in Step 14.

```javascript
// In runRecommendationPipeline():

const { buildRelationshipModel } = require('../relationships/relationshipModel');
const { discoverCapabilities } = require('../capabilities/capabilityDiscoveryEngine');
const { generateIntents } = require('../intents/analyticalIntentGenerator');
const { generateUniversalKPICandidates } = require('../kpi/universalKPIGenerator');

// After Step 1 (semantic classification):

// ─── Step 2a: Relationship Modeling ──────────────────────────────────────
const relationshipModel = buildRelationshipModel(columnSemantics);

// ─── Step 2b: Capability Discovery ───────────────────────────────────────
const capabilities = discoverCapabilities(relationshipModel);

// ─── Step 2c: Intent Generation ──────────────────────────────────────────
const { kpiIntents, chartIntents } = generateIntents(capabilities, columnSemantics);

// ─── Step 3: Universal KPI Generation (from intents) ─────────────────────
let kpiCandidates = generateUniversalKPICandidates(kpiIntents, columnSemantics);

// [Domain templates run here as SECONDARY supplement — Step 6/7 transition]
// Will be removed in Step 14
const domainKPIs = generateKPICandidates(domain, columnSemantics, schema);
// Merge — universal candidates first, domain as secondary
kpiCandidates = [...kpiCandidates, ...domainKPIs.filter(dk =>
  !kpiCandidates.some(uk => uk.column === dk.column && uk.aggregation === dk.aggregation)
)];
```

---

## Step 7 — Universal Chart Candidate Generation

**Risk:** High  
**Rationale:** Same as Step 6 but for chart candidates.

### 7.1 — Create `backend/src/analytics/charts/universalChartGenerator.js`

**Purpose:** Converts chart intents into chart candidates.

```javascript
/**
 * Universal Chart Generator
 *
 * Generates chart candidates from analytical intents.
 * Chart type is selected based on analytical intent + dimensional properties,
 * NOT from hardcoded domain templates.
 *
 * Chart type selection rules (per intent type):
 *   time_series:           line (> 5 time points) | bar (≤ 5 time points)
 *   categorical_breakdown: bar (always)
 *   frequency_distribution: bar (cardinality > 5) | pie (cardinality ≤ 5)
 *   proportion:            pie (cardinality ≤ 8) | bar (otherwise)
 *   correlation:           scatter
 */

const { validateAggregation } = require('../aggregation/aggregationRules');
const { INTENT_TYPES } = require('../intents/analyticalIntentGenerator');

/**
 * @param {Array<Object>} chartIntents - From generateIntents()
 * @param {Map<string, Object>} columnSemantics
 * @returns {Array<Object>} Chart candidates
 */
const generateUniversalChartCandidates = (chartIntents, columnSemantics) => {
  const candidates = [];

  for (const intent of chartIntents) {
    const xSem = columnSemantics.get(intent.xColumn);
    const ySem = intent.yColumn && intent.yColumn !== '_count'
      ? columnSemantics.get(intent.yColumn)
      : null;

    // Validate y-axis aggregation if y is a real column
    if (ySem) {
      const validation = validateAggregation(ySem.semanticRole, intent.aggregation);
      if (!validation.valid) {
        if (!validation.suggestedAggregation) continue; // skip invalid
        intent.aggregation = validation.suggestedAggregation;
      }
    }

    const chartType = selectChartType(intent, xSem, ySem);

    candidates.push({
      id: `chart-${intent.xColumn}-${intent.yColumn || 'count'}-${intent.aggregation}`,
      title: buildChartTitle(intent),
      chartType,
      xField: intent.xColumn,
      yField: intent.yColumn || '_count',
      aggregation: intent.aggregation,
      xSemanticRole: xSem?.semanticRole,
      ySemanticRole: ySem?.semanticRole,
      priority: intent.priority,
      domainRelevance: intent.analyticalValue,
      analyticalValue: intent.analyticalValue,
      businessReason: intent.businessReason,
      intentType: intent.type,
      source: 'universal'
    });
  }

  return candidates;
};

const selectChartType = (intent, xSem, ySem) => {
  // Use preferred type from intent if specified
  if (intent.preferredChartType) return intent.preferredChartType;

  switch (intent.type) {
    case INTENT_TYPES.TIME_SERIES:
      return 'line';
    case INTENT_TYPES.CATEGORICAL_BREAKDOWN:
      return 'bar';
    case INTENT_TYPES.FREQUENCY_DISTRIBUTION:
      return (xSem?.cardinalityCount || 10) <= 6 ? 'pie' : 'bar';
    case INTENT_TYPES.PROPORTION:
      return 'pie';
    case INTENT_TYPES.CORRELATION:
      return 'scatter';
    default:
      return 'bar';
  }
};

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

module.exports = { generateUniversalChartCandidates };
```

### 7.2 — Modify `recommendationPipeline.js`

Add chart candidate generation from intents (parallel to Step 6.2 for KPIs):

```javascript
const { generateUniversalChartCandidates } = require('../charts/universalChartGenerator');

// ─── Step 4: Universal Chart Generation (from intents) ───────────────────
let chartCandidates = generateUniversalChartCandidates(chartIntents, columnSemantics);

// Domain templates as secondary supplement (removed in Step 14)
const domainCharts = generateChartCandidates(domain, columnSemantics);
chartCandidates = [...chartCandidates, ...domainCharts.filter(dc =>
  !chartCandidates.some(uc =>
    uc.xField === dc.xField && uc.yField === dc.yField && uc.aggregation === dc.aggregation
  )
)];
```

---

## Step 8 — Statistical + Result Validation

**Risk:** Medium  
**Rationale:** Two validation gaps: (1) pre-execution statistical validation of candidates, (2) post-execution result validation of resolved data.

### 8.1 — Create `backend/src/analytics/validation/statisticalValidator.js`

**Purpose:** Pre-execution validation — rejects candidates that are statistically meaningless.

```javascript
/**
 * Statistical Validator
 *
 * Validates KPI and chart candidates before execution, rejecting those
 * that would produce statistically meaningless results.
 *
 * Rules:
 *   - Reject categorical breakdowns where cardinality > MAX_CATEGORICAL_CARDINALITY
 *   - Reject pie charts with cardinality > MAX_PIE_CATEGORIES
 *   - Reject KPIs on columns with null ratio > MAX_NULL_RATIO_FOR_KPI
 *   - Reject time series with only one temporal dimension (no date column exists)
 *   - Reject measure-only KPIs on columns with zero variance (all values identical)
 *     [checked post-execution — but flag low uniqueRatio as a pre-warning]
 */

const MAX_CATEGORICAL_CARDINALITY = 50;
const MAX_PIE_CATEGORIES = 10;
const MAX_NULL_RATIO_FOR_KPI = 0.60;

/**
 * @param {Array<Object>} kpiCandidates
 * @param {Map<string, Object>} columnSemantics
 * @returns {{ valid: Array, rejected: Array }}
 */
const validateKPICandidates = (kpiCandidates, columnSemantics) => {
  const valid = [];
  const rejected = [];

  for (const candidate of kpiCandidates) {
    const sem = columnSemantics.get(candidate.column);
    if (!sem) { rejected.push({ candidate, reason: 'Column not found in semantics' }); continue; }

    // Reject high null ratio
    if (sem.nullRatio > MAX_NULL_RATIO_FOR_KPI) {
      rejected.push({ candidate, reason: `High null ratio: ${(sem.nullRatio * 100).toFixed(1)}% missing` });
      continue;
    }

    // Reject sensitive/contact
    if (sem.isSensitive) {
      rejected.push({ candidate, reason: 'Sensitive column excluded from KPIs' });
      continue;
    }

    valid.push(candidate);
  }

  return { valid, rejected };
};

/**
 * @param {Array<Object>} chartCandidates
 * @param {Map<string, Object>} columnSemantics
 * @returns {{ valid: Array, rejected: Array }}
 */
const validateChartCandidates = (chartCandidates, columnSemantics) => {
  const valid = [];
  const rejected = [];

  for (const candidate of chartCandidates) {
    const xSem = columnSemantics.get(candidate.xField);

    if (!xSem) { rejected.push({ candidate, reason: 'X-axis column not in semantics' }); continue; }

    // Reject pie charts with too many categories
    if (candidate.chartType === 'pie' && xSem.cardinalityCount > MAX_PIE_CATEGORIES) {
      rejected.push({ candidate, reason: `Too many categories for pie (${xSem.cardinalityCount} > ${MAX_PIE_CATEGORIES})` });
      continue;
    }

    // Reject bar/line with high cardinality dimension (> 50 categories)
    if (['bar', 'line'].includes(candidate.chartType) && xSem.isDimensionalizable && xSem.cardinalityCount > MAX_CATEGORICAL_CARDINALITY) {
      // This is ok for date (temporal) dimensions but not for categorical
      if (!xSem.isTemporal) {
        rejected.push({ candidate, reason: `Cardinality too high for categorical chart (${xSem.cardinalityCount})` });
        continue;
      }
    }

    // Reject charts on sensitive columns
    if (xSem.isSensitive) {
      rejected.push({ candidate, reason: 'Sensitive X-axis column excluded' });
      continue;
    }

    valid.push(candidate);
  }

  return { valid, rejected };
};

module.exports = { validateKPICandidates, validateChartCandidates };
```

### 8.2 — Create `backend/src/analytics/validation/resultValidator.js`

**Purpose:** Post-execution validation — rejects or flags charts with meaningless resolved data.

```javascript
/**
 * Result Validator
 *
 * Validates resolved chart data after MongoDB aggregation.
 * Rejects charts that would render incorrectly or convey no information.
 *
 * Rules:
 *   - Reject empty result arrays (no data)
 *   - Reject single-point results (no meaningful visualization)
 *   - Reject zero-variance results (all Y values are identical)
 *   - Reject results with all NaN/null Y values
 *   - Reject pie charts where a single category is > 95% (not a useful breakdown)
 *   - Warn (but allow) if result count is very small (< 3 data points)
 */

const MIN_DATA_POINTS = 2;
const VARIANCE_THRESHOLD = 0.001; // relative coefficient of variation

/**
 * @param {Object} chart - Chart object with resolvedData
 * @returns {{ valid: boolean, reason: string | null, warning: string | null }}
 */
const validateChartResult = (chart) => {
  const data = chart.resolvedData || [];

  if (data.length === 0) {
    return { valid: false, reason: 'No data returned from aggregation' };
  }

  if (data.length < MIN_DATA_POINTS) {
    return { valid: false, reason: `Only ${data.length} data point(s) — insufficient for chart` };
  }

  // Check all Y values
  const yValues = data.map(d => d.y).filter(y => y !== null && y !== undefined && !isNaN(y));

  if (yValues.length === 0) {
    return { valid: false, reason: 'All Y values are null or NaN' };
  }

  // Zero variance check (all identical)
  const mean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
  if (mean !== 0) {
    const variance = yValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / yValues.length;
    const cv = Math.sqrt(variance) / Math.abs(mean); // coefficient of variation
    if (cv < VARIANCE_THRESHOLD) {
      return { valid: false, reason: `Zero variance in Y values (all values ≈ ${mean.toFixed(2)})` };
    }
  }

  // Pie chart dominance check
  if (chart.type?.includes('pie') && yValues.length > 1) {
    const total = yValues.reduce((a, b) => a + Math.abs(b), 0);
    const maxVal = Math.max(...yValues);
    if (total > 0 && maxVal / total > 0.95) {
      return { valid: true, warning: 'One category dominates (>95%) — pie chart may not be informative' };
    }
  }

  return { valid: true, reason: null, warning: null };
};

/**
 * @param {Object} kpi - KPI card object with value
 * @returns {{ valid: boolean, reason: string | null }}
 */
const validateKPIResult = (kpi) => {
  if (kpi.value === null || kpi.value === undefined) {
    return { valid: false, reason: 'KPI value is null' };
  }
  if (isNaN(kpi.value)) {
    return { valid: false, reason: 'KPI value is NaN' };
  }
  if (!isFinite(kpi.value)) {
    return { valid: false, reason: 'KPI value is Infinity' };
  }
  return { valid: true, reason: null };
};

module.exports = { validateChartResult, validateKPIResult };
```

### 8.3 — Integrate into `recommendationPipeline.js`

After scoring and before deduplication, add statistical validation:

```javascript
const { validateKPICandidates, validateChartCandidates } = require('../validation/statisticalValidator');

// After Step 3 (universal KPI gen) and Step 4 (universal chart gen):
const kpiValidation = validateKPICandidates(kpiCandidates, columnSemantics);
kpiCandidates = kpiValidation.valid;

const chartValidation = validateChartCandidates(chartCandidates, columnSemantics);
chartCandidates = chartValidation.valid;
```

### 8.4 — Integrate into `analyticsService.js`

After `generateCharts()` and after `calculateKPIs()`, add result validation:

```javascript
const { validateChartResult, validateKPIResult } = require('../analytics/validation/resultValidator');

// After calculateKPIs():
const validKPIs = kpis.filter(kpi => {
  const v = validateKPIResult(kpi);
  if (!v.valid) console.warn(`[ResultValidator] KPI "${kpi.kpi}" rejected: ${v.reason}`);
  return v.valid;
});

// After generateCharts():
const validCharts = charts.filter(chart => {
  const v = validateChartResult(chart);
  if (!v.valid) console.warn(`[ResultValidator] Chart "${chart.title}" rejected: ${v.reason}`);
  if (v.warning) console.warn(`[ResultValidator] Chart "${chart.title}" warning: ${v.warning}`);
  return v.valid;
});
```

---

## Step 9 — Analytical Utility Scoring

**Risk:** Medium  
**Rationale:** Replace the domain-biased `businessValueScorer.js` with a domain-neutral analytical utility scorer.

### Rewrite `backend/src/analytics/scoring/businessValueScorer.js`

**Remove:** `domainRelevance` as a 25% scoring factor (domain-hardcoded values)  
**Replace with:** `analyticalValue` (computed by relationship model), `informationGain`, `dataCoverage`

```javascript
/**
 * Analytical Utility Scorer — Universal
 *
 * Scores every KPI and chart candidate from 0 to 100.
 * Domain-neutral: scores based on data properties, not domain templates.
 *
 * Weighting:
 *   Analytical Value:        30%   (from relationship model, replaces domainRelevance)
 *   Semantic Validity:       20%   (role-based business value)
 *   Aggregation Suitability: 20%   (preferred/allowed/forbidden check)
 *   Data Coverage:           15%   (1 - nullRatio — is the column well-populated?)
 *   Visualization Quality:    10%  (chart type vs X-axis role fit)
 *   Uniqueness/Non-Redundancy: 5%  (placeholder until dedup)
 */

// Weights
const WEIGHTS = {
  analyticalValue: 0.30,
  semanticValidity: 0.20,
  aggregationSuitability: 0.20,
  dataCoverage: 0.15,
  visualizationQuality: 0.10,
  uniqueness: 0.05
};
```

The rest of the file keeps the same structure but uses `analyticalValue` (from the intent) instead of `domainRelevance` (from the template), and `dataCoverage = 100 * (1 - nullRatio)` instead of the old quality score.

---

## Step 10 — Diversity Optimization

**Risk:** Low  
**Rationale:** Top-N selection may pick multiple charts analyzing the same metric, ignoring other parts of the dataset.

### Modify `backend/src/analytics/recommendations/deduplicator.js`

Add a diversity-aware chart selection function:

```javascript
/**
 * Applies limits while maximizing analytical diversity.
 * 
 * Diversity rules:
 *   - At most 2 charts per Y-axis column (avoid all-revenue charts)
 *   - At most 2 charts per chart type (avoid all-bar charts)
 *   - Ensure at least 1 temporal chart if a date column exists
 *   - Ensure at least 1 categorical chart if a dimension column exists
 */
const applyChartLimitsWithDiversity = (rankedCharts) => {
  const perColumnCount = {};
  const perTypeCount = {};
  const selected = [];

  // First pass: collect primary charts
  for (const chart of rankedCharts) {
    if (selected.length >= LIMITS.TOTAL_CHART_MAX) break;
    if (chart.priority !== 'primary') continue;

    const colKey = chart.yField || chart.xField;
    const typeKey = chart.chartType;

    perColumnCount[colKey] = (perColumnCount[colKey] || 0);
    perTypeCount[typeKey] = (perTypeCount[typeKey] || 0);

    if (perColumnCount[colKey] >= 2) continue; // max 2 charts per metric
    if (perTypeCount[typeKey] >= 2) continue;  // max 2 of same type

    perColumnCount[colKey]++;
    perTypeCount[typeKey]++;
    selected.push(chart);
  }

  // Second pass: fill remaining slots with secondary, applying same diversity rules
  for (const chart of rankedCharts) {
    if (selected.length >= LIMITS.TOTAL_CHART_MAX) break;
    if (chart.priority === 'primary') continue;
    if (selected.some(s => s.id === chart.id)) continue;

    const colKey = chart.yField || chart.xField;
    const typeKey = chart.chartType;

    perColumnCount[colKey] = (perColumnCount[colKey] || 0);
    perTypeCount[typeKey] = (perTypeCount[typeKey] || 0);

    if (perColumnCount[colKey] >= 2) continue;
    if (perTypeCount[typeKey] >= 3) continue; // slightly more lenient for secondary

    perColumnCount[colKey]++;
    perTypeCount[typeKey]++;
    selected.push(chart);
  }

  return selected;
};
```

Export alongside existing functions. Update `recommendationPipeline.js` to use `applyChartLimitsWithDiversity` instead of `applyChartLimits`.

---

## Step 11 — Temporal Intelligence

**Risk:** Medium  
**Rationale:** Replace naive date grouping with granularity-aware aggregation.

### New File: `backend/src/analytics/execution/temporalAggregationExecutor.js`

```javascript
/**
 * Temporal Aggregation Executor
 *
 * Selects the correct temporal granularity for time-series charts
 * and builds the corresponding MongoDB aggregation pipeline stage.
 *
 * Granularity selection:
 *   < 60 days  -> 'day'    ($dateToString: "%Y-%m-%d")
 *   < 180 days -> 'week'   ($week + $year composite)
 *   < 730 days -> 'month'  ($dateToString: "%Y-%m")
 *   < 2000 days -> 'quarter' (computed)
 *   >= 2000 days -> 'year' ($dateToString: "%Y")
 */

const selectGranularity = (minDate, maxDate) => {
  if (!minDate || !maxDate) return 'month';
  const days = (maxDate - minDate) / (1000 * 60 * 60 * 24);
  if (days < 60) return 'day';
  if (days < 180) return 'week';
  if (days < 730) return 'month';
  if (days < 2000) return 'quarter';
  return 'year';
};

const buildTemporalGroupId = (dateField, granularity) => {
  const field = `$data.${dateField}`;
  switch (granularity) {
    case 'day':
      return { $dateToString: { format: '%Y-%m-%d', date: field } };
    case 'week':
      return {
        year: { $isoWeekYear: field },
        week: { $isoWeek: field }
      };
    case 'month':
      return { $dateToString: { format: '%Y-%m', date: field } };
    case 'quarter': {
      const q = { $ceil: { $divide: [{ $month: field }, 3] } };
      return {
        year: { $year: field },
        quarter: q
      };
    }
    case 'year':
      return { $dateToString: { format: '%Y', date: field } };
    default:
      return { $dateToString: { format: '%Y-%m', date: field } };
  }
};

const formatTemporalLabel = (groupId, granularity) => {
  if (typeof groupId === 'string') return groupId;
  if (granularity === 'week') return `Week ${groupId.week}, ${groupId.year}`;
  if (granularity === 'quarter') return `Q${groupId.quarter} ${groupId.year}`;
  return JSON.stringify(groupId);
};

/**
 * Builds a temporal aggregation pipeline for analyticsService.generateCharts().
 * Replaces the naive $group: { _id: "$data.dateCol" } stage.
 */
const buildTemporalPipeline = (dateField, metricField, aggregation, minDate, maxDate) => {
  const granularity = selectGranularity(minDate, maxDate);
  const groupId = buildTemporalGroupId(dateField, granularity);

  let yAgg;
  if (aggregation === 'count' || !metricField || metricField === '_count') {
    yAgg = { $sum: 1 };
  } else if (aggregation === 'sum') {
    yAgg = { $sum: `$data.${metricField}` };
  } else if (aggregation === 'avg') {
    yAgg = { $avg: `$data.${metricField}` };
  } else {
    yAgg = { $sum: 1 };
  }

  return {
    pipeline: [
      { $group: { _id: groupId, yVal: yAgg } },
      { $project: { _id: 0, x: '$_id', y: '$yVal' } },
      { $sort: { x: 1 } }
    ],
    granularity,
    formatLabel: (groupId) => formatTemporalLabel(groupId, granularity)
  };
};

module.exports = { buildTemporalPipeline, selectGranularity };
```

### Modify `analyticsService.js`

Replace the naive date grouping block (L511-535) with a call to `buildTemporalPipeline`:

```javascript
const { buildTemporalPipeline } = require('../analytics/execution/temporalAggregationExecutor');

// In generateCharts(), where isDate is true:
if (isDate) {
  // Query date range for granularity selection
  const bounds = await DataRow.aggregate([
    { $match: baseMatch },
    { $group: { _id: null, min: { $min: `$data.${xField}` }, max: { $max: `$data.${xField}` } } }
  ]);
  const minDate = bounds[0]?.min ? new Date(bounds[0].min) : null;
  const maxDate = bounds[0]?.max ? new Date(bounds[0].max) : null;

  const temporal = buildTemporalPipeline(xField, yField === '_count' ? null : yField, aggregation, minDate, maxDate);
  pipeline = [{ $match: baseMatch }, ...temporal.pipeline];
} else {
  // Categorical/scatter pipeline (unchanged)
}
```

---

## Step 12 — Fix Filter Regeneration Bug

**Risk:** High (production bug fix)  
**Rationale:** Applying a filter currently re-runs domain classification + template matching + AI enrichment. It should only affect the data queries.

### Modify `dashboardAnalyticsController.js`

```javascript
// CURRENT (broken):
if (hasFilters) {
  const filteredData = await AnalyticsService.generateDashboard(dataSource.toObject(), filters);
  return res.status(200).json({ ... });
}

// TARGET (fixed):
if (hasFilters) {
  // Reuse the existing cached recommendation (kpis, charts config)
  // Only re-execute the data queries with the filter applied
  let analytics = await Analytics.findOne({ dataSourceId: dataSource._id, orgId: req.user.orgId });
  
  if (!analytics) {
    // No cache — generate full pipeline once, then apply filters
    analytics = await AnalyticsService.persistAnalytics(dataSource._id, req.user.orgId);
  }
  
  // Re-execute KPI and chart queries with filter (new method)
  const filteredData = await AnalyticsService.applyFiltersToExistingRecommendations(
    dataSource.toObject(),
    analytics,
    { date, department, region, product, category, salesperson }
  );
  
  return res.status(200).json({
    dataSourceId: dataSource._id,
    fileName: dataSource.fileName,
    ...filteredData
  });
}
```

### Add `AnalyticsService.applyFiltersToExistingRecommendations()` in `analyticsService.js`

```javascript
/**
 * Re-executes only the data queries (KPI and chart aggregations) using
 * the cached recommendations, applying the provided filters.
 * 
 * Does NOT re-run: domain classification, template matching, AI enrichment.
 */
static async applyFiltersToExistingRecommendations(dataSource, cachedAnalytics, filters) {
  // Extract the KPI mappings from the cached analytics
  const cachedKPIs = cachedAnalytics.kpis || [];
  const cachedCharts = cachedAnalytics.charts || [];
  
  // Reconstruct the mappedColsList from cached KPIs
  const mappedColsList = cachedKPIs.map(kpi => ({
    kpi: kpi.kpi,
    column: kpi.column || kpi.kpi, // column saved in cache
    label: kpi.label,
    format: kpi.format,
    icon: kpi.icon,
    color: kpi.color,
    aggregation: kpi.aggregation
  }));
  
  // Re-execute KPI queries with filter
  const kpis = await this.calculateKPIs(dataSource, mappedColsList, filters);
  
  // Re-execute chart queries with filter
  // Charts need to be re-executed using the cached chart configs
  const charts = await this.reExecuteChartsWithFilter(dataSource, cachedCharts, filters);
  
  return {
    kpis,
    charts,
    insights: cachedAnalytics.insights, // reuse LLM insights from cache
    filters: cachedAnalytics.filters,
    reports: cachedAnalytics.reports,
    recommendations: cachedAnalytics.recommendations
  };
}
```

> **Note:** This requires the cache to store `column` on each KPI card. Verify that `persistAnalytics()` saves enough metadata, and add the column field to the KPI card object if not present.

### Also fix `dashboardStore.js` frontend filter keys

The Zustand store has hardcoded domain-specific filter keys. These should be dynamic based on the actual dataset's categorical columns:

```javascript
// Remove the hardcoded filter keys
// Replace with dynamic filter state driven by API response
filters: {}  // Start empty, populated from API's filterOptions response

// The UI's DashboardFilters component should render dropdowns based on 
// dashboard.filters object returned by the API (which contains the actual
// column names and their values)
```

---

## Step 13 — Move Frontend Analytics to Backend

**Risk:** High  
**Rationale:** `visualizationUtils.js` performs full aggregation in the browser, violating the architecture.

### 13.1 — Create `backend/src/routes/analyticsPreviewRouter.js`

Add a new endpoint that accepts chart config and returns pre-aggregated data:

```
GET /datasources/:id/analytics-preview
Query params:
  xField:      column name
  yField:      column name or "_count"
  aggregation: sum | avg | count | min | max
  groupBy:     optional secondary grouping
  filters:     JSON object with column → value pairs
```

This endpoint:
1. Validates the request against the actual schema
2. Validates the aggregation against the semantic role of `yField`
3. Executes a MongoDB aggregate query
4. Returns `{ data: Array<{x, y}>, metadata: {...} }`

### 13.2 — Modify `useAutoVisualization.js`

Replace browser-side `aggregateData()` call with API call:

```javascript
// BEFORE:
const aggregatedData = aggregateData(rawRows, xField, yField, aggregation, ...);

// AFTER:
const aggregatedData = await fetchAnalyticsPreview(dsId, { xField, yField, aggregation, filters, apiRequest });
// fetchAnalyticsPreview calls GET /datasources/:id/analytics-preview
```

Remove imports of `aggregateData`, `recommendChart`, `generateInsights` from `visualizationUtils.js`.

### 13.3 — Keep in `visualizationUtils.js`

- `detectColumnTypes()` — used for UI column type display (not analytics)
- Date formatting helpers

### 13.4 — Remove from `visualizationUtils.js`

- `aggregateData()` — move to backend
- `recommendChart()` — replaced by backend intent-based recommendation
- `generateInsights()` — replaced by backend `insightGeneratorService.js`

---

## Step 14 — Demote Domain to Optional Context

**Risk:** High  
**Rationale:** After all universal systems are working, domain becomes advisory only.

> **Prerequisite:** Steps 6, 7, 8, 9, 10, 11 must be complete and verified. The universal pipeline must be producing results at least as good as the domain-template path for the datasets used in testing.

### 14.1 — Modify `recommendationPipeline.js`

Remove the domain template supplement added in Steps 6/7:

```javascript
// REMOVE these lines added in Step 6.2:
// const domainKPIs = generateKPICandidates(domain, columnSemantics, schema);
// kpiCandidates = [...kpiCandidates, ...domainKPIs.filter(...)];

// REMOVE these lines added in Step 7.2:
// const domainCharts = generateChartCandidates(domain, columnSemantics);
// chartCandidates = [...chartCandidates, ...domainCharts.filter(...)];
```

### 14.2 — Modify AI enrichment prompt in `recommendationPipeline.js`

Replace domain-biased prompt:

```javascript
// BEFORE:
`You are a senior business intelligence analyst specializing in ${domain.toUpperCase()} analytics.`

// AFTER:
`You are a senior business intelligence analyst specializing in universal dataset analytics.
The dataset appears to relate to: "${domain}" (confidence: ${domainConfidence}%).
This is provided as context only. Your suggestions must be valid for ANY dataset with this structure.`
```

### 14.3 — Modify `insightGeneratorService.js`

Remove domain from prompt anchor:

```javascript
// BEFORE:
`You are a senior business intelligence AI analyst specializing in ${domainLabel} analytics.`

// AFTER:
`You are a senior business intelligence AI analyst. You are analyzing a dataset${domainLabel !== 'general' ? ` that appears to be a ${domainLabel} dataset` : ''}.`
```

### 14.4 — Do NOT delete `domainProfiles.js` yet

Keep `domainProfiles.js` as a reference. Archive it only after production validation over 2+ weeks confirms universal pipeline is superior.

---

## Verification Strategy (Per Step)

After each step, run:

```bash
# Backend smoke test
cd backend && npm run dev
# Must start without errors

# Run existing test suite
cd backend && npm test
# All existing tests must pass

# Upload a test dataset
# Verify dashboard generates expected KPIs and charts
# Check backend console for [RecommendationPipeline] logs
```

### Target test datasets (save as `backend/tests/fixtures/`):

| Dataset | Purpose | Expected Domain Behavior |
|---------|---------|--------------------------|
| `hr_employees.csv` (salary, dept, hire_date) | Validates HR path | Should NOT require HR domain to get salary KPI |
| `sensor_readings.csv` (timestamp, temperature, device_id) | Validates temporal | Should auto-detect time series, no domain match |
| `survey_results.csv` (rating, category, comments) | Validates ordinal | Should NOT SUM ratings |
| `generic_data.csv` (col1, col2, col3 with no keywords) | Validates fallback | Must still produce a dashboard |

---

## File Creation / Modification Summary

### New Files (8)

```
backend/src/analytics/relationships/relationshipModel.js
backend/src/analytics/capabilities/capabilityDiscoveryEngine.js
backend/src/analytics/intents/analyticalIntentGenerator.js
backend/src/analytics/kpi/universalKPIGenerator.js
backend/src/analytics/charts/universalChartGenerator.js
backend/src/analytics/validation/statisticalValidator.js
backend/src/analytics/validation/resultValidator.js
backend/src/analytics/execution/temporalAggregationExecutor.js
backend/src/routes/analyticsPreviewRouter.js
```

### Modified Files (9)

```
backend/src/services/parserService.js          (Step 2 — add stats)
backend/src/analytics/semantic/semanticClassifier.js  (Step 2 — use stats)
backend/src/analytics/recommendations/recommendationPipeline.js  (Steps 6,7,8,10,14)
backend/src/analytics/recommendations/deduplicator.js  (Step 10)
backend/src/analytics/scoring/businessValueScorer.js   (Step 9)
backend/src/services/analyticsService.js               (Steps 8,11,12)
backend/src/controllers/dashboardAnalyticsController.js (Step 12)
frontend/src/features/analytics/hooks/useAutoVisualization.js  (Step 13)
frontend/src/features/dashboard/store/dashboardStore.js         (Step 12)
```

### Deleted Files (15)

```
backend/src/services/ai/aiService.js
backend/src/services/ai/kpiRecommendationEngine.js
backend/src/services/ai/chartRecommendationEngine.js
backend/src/services/ai/columnRoleDetector.js
backend/src/services/ai/datasetClassifier.js
backend/src/services/ai/geminiClient.js
backend/src/services/ai/insightGenerator.js
backend/src/services/ai/promptBuilder.js
backend/src/services/ai/responseParser.js
backend/src/services/ai/retryHandler.js
backend/src/services/ai/schemaValidator.js
backend/src/services/dashboard/dashboardGenerator.js
backend/test-err.js
backend/test-mapping.js
backend/test_gemini_recs.js
```

---

*Phase 2 Complete. Ready for execution on user approval.*
