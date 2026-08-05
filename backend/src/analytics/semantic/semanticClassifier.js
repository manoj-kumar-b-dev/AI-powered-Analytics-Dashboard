/**
 * Semantic Column Classifier
 *
 * Assigns a SEMANTIC ROLE to every column in a dataset schema beyond
 * the physical type detected by metadata extraction.
 *
 * Physical types: string | integer | float | date | boolean
 * Semantic roles: identifier | monetary_metric | additive_metric |
 *   non_additive_metric | percentage_metric | ratio_metric |
 *   ordinal_metric | demographic_attribute | categorical_dimension |
 *   geographic_dimension | temporal_dimension | status_dimension |
 *   text_attribute | contact_information | sensitive_attribute | unknown
 *
 * This is the single source of truth for column semantics.
 * All KPI and chart generators must consult this module.
 */

// ---------------------------------------------------------------------------
// Semantic role constants
// ---------------------------------------------------------------------------
const SEMANTIC_ROLES = {
  IDENTIFIER: 'identifier',
  MONETARY_METRIC: 'monetary_metric',
  ADDITIVE_METRIC: 'additive_metric',
  NON_ADDITIVE_METRIC: 'non_additive_metric',
  PERCENTAGE_METRIC: 'percentage_metric',
  RATIO_METRIC: 'ratio_metric',
  ORDINAL_METRIC: 'ordinal_metric',
  DEMOGRAPHIC_ATTRIBUTE: 'demographic_attribute',
  CATEGORICAL_DIMENSION: 'categorical_dimension',
  GEOGRAPHIC_DIMENSION: 'geographic_dimension',
  TEMPORAL_DIMENSION: 'temporal_dimension',
  STATUS_DIMENSION: 'status_dimension',
  TEXT_ATTRIBUTE: 'text_attribute',
  CONTACT_INFORMATION: 'contact_information',
  SENSITIVE_ATTRIBUTE: 'sensitive_attribute',
  UNKNOWN: 'unknown'
};

// ---------------------------------------------------------------------------
// Pattern libraries for name-based detection
// ---------------------------------------------------------------------------

/** Columns that are identifiers and must never be aggregated numerically */
const IDENTIFIER_PATTERNS = [
  /^(.*_)?id$/i,
  /^id[_-]/i,
  /_id$/i,
  /^(uuid|guid)$/i,
  /^(employee|emp|customer|cust|order|order_no|invoice|txn|transaction|ticket|case|sku|product|item|ref|reference|record|row|serial|number|num)_?(id|no|num|number|code|key)$/i,
  /^(code|key)$/i,
  /^(barcode|ean|upc)$/i
];

/** Monetary / financial metrics — SUM and AVG are both valid */
const MONETARY_PATTERNS = [
  /revenue/i, /sales/i, /income/i, /turnover/i, /gmv/i,
  /profit/i, /margin/i, /earnings/i, /ebit/i, /ebitda/i,
  /expense/i, /cost/i, /spend/i, /expenditure/i, /overhead/i, /outflow/i,
  /budget/i, /actual/i, /forecast/i, /target/i,
  /salary/i, /wage/i, /compensation/i, /pay(?:ment|roll)?$/i, /remuneration/i, /ctc/i,
  /amount/i, /value/i, /price/i, /fee/i, /charge/i, /rate(?!ing)/i,
  /inr$/i, /usd$/i, /eur$/i, /gbp$/i, /cad$/i, /aud$/i,
  /cash/i, /balance/i, /debit/i, /credit/i, /invoice/i,
  /discount(?!_pct|_rate|_percent)/i, /rebate/i, /commission/i,
  /total(?!_count|_records)/i, /net(?!_count)/i, /gross/i
];

/** Percentage / rate metrics — AVG is valid; SUM is INVALID */
const PERCENTAGE_PATTERNS = [
  /pct$/i, /percent$/i, /percentage$/i, /_pct_?$/i, /_percent_?$/i,
  /\bpct\b/i, /\bpercent\b/i,
  /rate$/i, /ratio$/i,
  /attendance/i,
  /utilization/i, /occupancy/i, /capacity_utilization/i,
  /fill_rate/i, /hit_rate/i, /conversion_rate/i, /open_rate/i, /click_rate/i,
  /churn_rate/i, /retention_rate/i, /win_rate/i, /pass_rate/i, /success_rate/i,
  /completion_rate/i, /response_rate/i, /acceptance_rate/i,
  /margin_pct/i, /growth_rate/i
];

/** Ordinal / score metrics — AVG, median, distribution valid; SUM is INVALID */
const ORDINAL_PATTERNS = [
  /rating/i, /score/i, /rank/i, /grade/i,
  /performance/i,
  /satisfaction/i, /csat/i, /nps/i, /star/i,
  /level/i, /tier/i, /priority/i, /severity/i,
  /gpa/i, /band/i
];

/** Demographic attributes — AVG, median, distribution valid; SUM is INVALID */
const DEMOGRAPHIC_PATTERNS = [
  /^age$/i, /age_?(?:years|at|group|range|band)?$/i,
  /^gender$/i, /^sex$/i,
  /year_?of_?birth/i, /birth_?year/i, /dob/i, /date_of_birth/i,
  /experience(?:_years)?$/i, /tenure$/i, /years?_?(?:of_?)?experience/i,
  /seniority/i
];

/** Geographic dimensions */
const GEOGRAPHIC_PATTERNS = [
  /country/i, /nation/i,
  /state/i, /province/i, /region/i, /territory/i, /zone/i,
  /city/i, /town/i, /district/i, /county/i, /municipality/i,
  /location/i, /address/i, /street/i, /zip/i, /postal/i, /pin(?:code)?/i,
  /branch/i, /plant/i, /warehouse/i, /site/i
];

/** Status / boolean-like dimensions */
const STATUS_PATTERNS = [
  /^status$/i, /^state$/i,
  /^is_/i, /^has_/i, /^was_/i,
  /employment_?status/i, /job_?status/i, /active$/i, /inactive$/i,
  /flagged/i, /enabled/i, /verified/i, /approved/i,
  /exit_?type/i, /exit_?reason/i, /attrition_?reason/i,
  /termination_?reason/i
];

/** Contact / PII information — should be excluded from analysis */
const CONTACT_PATTERNS = [
  /email/i, /e_?mail/i,
  /phone/i, /mobile/i, /contact/i, /tel(?:ephone)?/i, /fax/i,
  /url/i, /website/i, /link/i, /href/i
];

/** Sensitive / PII — should be excluded from analysis */
const SENSITIVE_PATTERNS = [
  /ssn/i, /social_security/i, /passport/i, /national_id/i, /aadhar/i, /pan_no/i,
  /driving_license/i, /ip_address/i, /device_id/i,
  /^(first_?name|last_?name|full_?name|name)$/i
];

/** Temporal dimensions */
const TEMPORAL_PATTERNS = [
  /date/i, /time/i, /timestamp/i, /datetime/i,
  /year$/i, /month$/i, /quarter$/i, /week$/i, /day$/i,
  /period/i, /fiscal/i, /created_?at/i, /updated_?at/i, /modified/i,
  /join(?:ing)?_?date/i, /hire_?date/i, /start_?date/i, /end_?date/i,
  /exit_?date/i, /termination_?date/i, /resignation_?date/i,
  /order_?date/i, /invoice_?date/i, /due_?date/i, /delivery_?date/i,
  /birth_?date/i
];

/** Additive count/volume metrics — SUM is valid */
const ADDITIVE_PATTERNS = [
  /count$/i, /quantity/i, /qty/i, /units?$/i, /volume/i,
  /headcount/i, /transactions?/i, /orders?$/i, /calls?$/i, /tickets?$/i,
  /sessions?/i, /views?$/i, /clicks?$/i, /impressions?$/i, /conversions?$/i,
  /downloads?$/i, /installs?$/i, /signups?$/i,
  /hours?$/i, /days?_?worked$/i, /overtime/i,
  /defects?$/i, /issues?$/i, /errors?$/i, /incidents?$/i,
  /production$/i, /output$/i, /units?_?produced/i, /batch(?:es)?$/i,
  /shipments?$/i, /deliveries$/i, /packages?$/i
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes a column name for pattern matching.
 * @param {string} name
 * @returns {string}
 */
const normalizeName = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, '_');

/**
 * Tests a column name against an array of RegExp patterns.
 * @param {string} name
 * @param {RegExp[]} patterns
 * @returns {boolean}
 */
const matchesAny = (name, patterns) => patterns.some(p => p.test(name));

/**
 * Returns the physical type based on what metadata extraction detected.
 * Maps from the schema `type` field to a canonical physical type.
 * @param {Object} col - schema column
 * @returns {string}
 */
const getPhysicalType = (col) => {
  const t = (col.type || col.inferredType || '').toLowerCase();
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'date';
  if (t === 'boolean' || t === 'bool') return 'boolean';
  if (t === 'currency' || t === 'percentage') return 'number';
  if (t === 'numeric' || t === 'number' || t === 'integer' || t === 'float') return 'number';
  if (t === 'categorical' || t === 'category') return 'string';
  if (t === 'text' || t === 'string') return 'string';
  return 'string';
};

/**
 * Checks if the column's sample values are all numeric.
 * @param {Array} sampleValues
 * @returns {boolean}
 */
const sampleValuesAreNumeric = (sampleValues = []) => {
  const nonEmpty = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(v => !isNaN(Number(String(v).replace(/[$,%]/g, ''))));
};

// ---------------------------------------------------------------------------
// Core classification function
// ---------------------------------------------------------------------------

/**
 * Classifies a single column into a semantic role.
 *
 * @param {Object} col - Column schema entry (must have `column` or `name`, `type`)
 * @param {Array} [sampleValues] - Optional sample values from the column
 * @returns {{ column: string, physicalType: string, semanticRole: string, confidence: number, reason: string }}
 */
const classifyColumn = (col, sampleValues = []) => {
  const name = col.column || col.name || '';
  const norm = normalizeName(name);
  const physicalType = getPhysicalType(col);

  // --- 1. Identifier check (highest priority — regardless of type) ---
  if (matchesAny(norm, IDENTIFIER_PATTERNS)) {
    return {
      column: name,
      physicalType: physicalType || 'string',
      semanticRole: SEMANTIC_ROLES.IDENTIFIER,
      confidence: 0.97,
      reason: `Column "${name}" matches identifier naming patterns (ID, code, key, etc.)`
    };
  }

  // --- 2. Contact / PII check ---
  if (matchesAny(norm, CONTACT_PATTERNS)) {
    return {
      column: name,
      physicalType,
      semanticRole: SEMANTIC_ROLES.CONTACT_INFORMATION,
      confidence: 0.95,
      reason: `Column "${name}" contains contact/PII information (email, phone, URL)`
    };
  }

  // --- 3. Sensitive / PII check ---
  if (matchesAny(norm, SENSITIVE_PATTERNS)) {
    return {
      column: name,
      physicalType,
      semanticRole: SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE,
      confidence: 0.95,
      reason: `Column "${name}" contains sensitive personal information (name, SSN, passport, etc.)`
    };
  }

  // --- 4. Temporal dimension check ---
  if (physicalType === 'date' || matchesAny(norm, TEMPORAL_PATTERNS)) {
    return {
      column: name,
      physicalType: physicalType === 'date' ? 'date' : physicalType,
      semanticRole: SEMANTIC_ROLES.TEMPORAL_DIMENSION,
      confidence: physicalType === 'date' ? 0.99 : 0.88,
      reason: `Column "${name}" represents a temporal/date dimension`
    };
  }

  // --- 5. Boolean / status check ---
  if (physicalType === 'boolean') {
    return {
      column: name,
      physicalType: 'boolean',
      semanticRole: SEMANTIC_ROLES.STATUS_DIMENSION,
      confidence: 0.92,
      reason: `Column "${name}" is a boolean flag, classified as status dimension`
    };
  }

  // --- For numeric columns, check semantic role carefully ---
  if (physicalType === 'number' || col.type === 'numeric' || col.type === 'currency' || col.type === 'percentage') {

    // 6. Percentage / rate check (before monetary, since some patterns overlap)
    if (col.type === 'percentage' || matchesAny(norm, PERCENTAGE_PATTERNS)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.PERCENTAGE_METRIC,
        confidence: col.type === 'percentage' ? 0.99 : 0.93,
        reason: `Column "${name}" is a percentage/rate metric — SUM is invalid; AVG is preferred`
      };
    }

    // 7. Ordinal / score / rating check
    if (matchesAny(norm, ORDINAL_PATTERNS)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.ORDINAL_METRIC,
        confidence: 0.92,
        reason: `Column "${name}" is an ordinal metric (rating, score, rank) — SUM is invalid; AVG is preferred`
      };
    }

    // 8. Demographic attribute check
    if (matchesAny(norm, DEMOGRAPHIC_PATTERNS)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE,
        confidence: 0.95,
        reason: `Column "${name}" is a demographic attribute (age, tenure, experience) — SUM is invalid; AVG is preferred`
      };
    }

    // 9. Monetary metric check
    if (col.type === 'currency' || matchesAny(norm, MONETARY_PATTERNS)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.MONETARY_METRIC,
        confidence: col.type === 'currency' ? 0.99 : 0.90,
        reason: `Column "${name}" is a monetary/financial metric — SUM and AVG are valid`
      };
    }

    // 10. Additive count/volume metric check
    if (matchesAny(norm, ADDITIVE_PATTERNS)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.ADDITIVE_METRIC,
        confidence: 0.88,
        reason: `Column "${name}" is an additive count/volume metric — SUM and AVG are valid`
      };
    }

    // 11. Ratio metric (name contains ratio but not rate/percent)
    if (/ratio/i.test(norm) || /index/i.test(norm)) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.RATIO_METRIC,
        confidence: 0.85,
        reason: `Column "${name}" is a ratio/index metric — AVG is preferred; SUM is invalid`
      };
    }

    // 12. Use stats-enhanced cardinality check for generic numerics
    // High uniqueRatio (near 1.0) on a numeric column strongly suggests an identifier
    const uniqueRatio = col.uniqueRatio !== undefined ? col.uniqueRatio : 1;
    const cardinalityCount = col.cardinalityCount || col.uniqueValueCount || col.unique_count || 0;
    const cardinalityClass = col.cardinalityClass || (cardinalityCount < 20 ? 'low' : 'high');

    if (uniqueRatio > 0.95 && cardinalityCount > 20) {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.IDENTIFIER,
        confidence: 0.80,
        reason: `Column "${name}" is numeric with very high unique ratio (${(uniqueRatio * 100).toFixed(0)}%) — likely a numeric identifier`
      };
    }

    if (cardinalityClass === 'low' || cardinalityClass === 'binary') {
      return {
        column: name,
        physicalType: 'number',
        semanticRole: SEMANTIC_ROLES.ORDINAL_METRIC,
        confidence: 0.65,
        reason: `Column "${name}" is numeric with low cardinality (${cardinalityCount} unique values) — likely ordinal/categorical`
      };
    }

    return {
      column: name,
      physicalType: 'number',
      semanticRole: SEMANTIC_ROLES.ADDITIVE_METRIC,
      confidence: 0.70,
      reason: `Column "${name}" is a generic numeric metric — SUM and AVG assumed valid (low-confidence)`
    };
  }

  // --- For string / categorical columns ---
  if (physicalType === 'string') {
    // 13. Status dimension
    if (matchesAny(norm, STATUS_PATTERNS)) {
      return {
        column: name,
        physicalType: 'string',
        semanticRole: SEMANTIC_ROLES.STATUS_DIMENSION,
        confidence: 0.92,
        reason: `Column "${name}" is a status/flag dimension`
      };
    }

    // 14. Geographic dimension
    if (matchesAny(norm, GEOGRAPHIC_PATTERNS)) {
      return {
        column: name,
        physicalType: 'string',
        semanticRole: SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION,
        confidence: 0.90,
        reason: `Column "${name}" is a geographic dimension`
      };
    }

    // 15. Categorical dimension (low/medium cardinality) vs high-cardinality text
    // Use stats-based cardinality if available, otherwise fall back to uniqueValueCount
    const statsCardinality = col.cardinalityCount || col.uniqueValueCount || col.unique_count || 0;
    const statsClass = col.cardinalityClass || (statsCardinality < 50 ? 'medium' : 'high');
    const statsUniqueRatio = col.uniqueRatio !== undefined ? col.uniqueRatio : 1;

    // High uniqueRatio + high cardinality on text = likely identifier / free-form text
    if (statsUniqueRatio > 0.95 && statsCardinality > 50) {
      return {
        column: name,
        physicalType: 'string',
        semanticRole: SEMANTIC_ROLES.TEXT_ATTRIBUTE,
        confidence: 0.78,
        reason: `Column "${name}" has very high cardinality (${statsCardinality} unique values, ${(statsUniqueRatio * 100).toFixed(0)}% unique) — treated as high-cardinality text`
      };
    }

    if (col.type === 'categorical' || col.type === 'boolean' || statsClass === 'binary' || statsClass === 'low' || statsClass === 'medium') {
      return {
        column: name,
        physicalType: 'string',
        semanticRole: SEMANTIC_ROLES.CATEGORICAL_DIMENSION,
        confidence: 0.82,
        reason: `Column "${name}" is a categorical dimension (${statsCardinality} unique values, class: ${statsClass})`
      };
    }

    // High-cardinality text
    return {
      column: name,
      physicalType: 'string',
      semanticRole: SEMANTIC_ROLES.TEXT_ATTRIBUTE,
      confidence: 0.70,
      reason: `Column "${name}" is a high-cardinality text attribute`
    };
  }

  // Fallback
  return {
    column: name,
    physicalType,
    semanticRole: SEMANTIC_ROLES.UNKNOWN,
    confidence: 0.3,
    reason: `Column "${name}" could not be semantically classified`
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies all columns in a schema array.
 *
 * @param {Array} schema - Array of column objects from DataSource.schema
 *   Each object should have: { column, type, sampleValues? }
 * @returns {Map<string, Object>} Map of columnName → semantic classification
 */
const classifyColumns = (schema) => {
  const result = new Map();
  if (!Array.isArray(schema)) return result;

  for (const col of schema) {
    const colName = col.column || col.name;
    if (!colName) continue;
    const sampleValues = col.sampleValues || [];
    const classification = classifyColumn(col, sampleValues);

    const role = classification.semanticRole;

    // --- Analytical flags (derived from semantic role + schema stats) ---
    // These are consumed directly by RelationshipModel, CapabilityDiscovery, IntentGenerator
    // so they don't have to re-derive them from role name strings.

    const isIdentifier = (
      role === SEMANTIC_ROLES.IDENTIFIER ||
      role === SEMANTIC_ROLES.CONTACT_INFORMATION ||
      role === SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE
    );

    const isSensitive = (
      role === SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE ||
      role === SEMANTIC_ROLES.CONTACT_INFORMATION
    );

    const isTemporal = (
      role === SEMANTIC_ROLES.TEMPORAL_DIMENSION ||
      col.type === 'date'
    );

    const isAdditive = (
      role === SEMANTIC_ROLES.MONETARY_METRIC ||
      role === SEMANTIC_ROLES.ADDITIVE_METRIC
    );

    // Columns that can appear as Y-axis / KPI value
    const isAggregatable = (
      !isIdentifier &&
      !isTemporal &&
      !isSensitive &&
      (classification.physicalType === 'number' || col.type === 'numeric' || col.type === 'currency' || col.type === 'percentage') &&
      role !== SEMANTIC_ROLES.UNKNOWN
    );

    // Columns that can appear as X-axis / GROUP BY dimension
    const isDimensionalizable = (
      !isIdentifier &&
      !isSensitive &&
      !isTemporal &&
      (
        role === SEMANTIC_ROLES.CATEGORICAL_DIMENSION ||
        role === SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION ||
        role === SEMANTIC_ROLES.STATUS_DIMENSION ||
        col.type === 'categorical' ||
        col.type === 'boolean' ||
        (col.cardinalityClass && col.cardinalityClass !== 'high')
      )
    );

    result.set(colName, {
      ...classification,
      // Pass-through stats from schema (zero-fill if missing for backward compat)
      nullRatio: col.nullRatio !== undefined ? col.nullRatio : 0,
      uniqueRatio: col.uniqueRatio !== undefined ? col.uniqueRatio : 1,
      cardinalityCount: col.cardinalityCount || 0,
      cardinalityClass: col.cardinalityClass || 'high',
      // Analytical flags
      isAdditive,
      isAggregatable,
      isDimensionalizable,
      isTemporal,
      isIdentifier,
      isSensitive
    });
  }

  return result;
};

/**
 * Classifies a single column by name + type lookup.
 * Convenience wrapper for one-off lookups.
 *
 * @param {Object} col - Column schema entry
 * @param {Array} [sampleValues]
 * @returns {Object} classification
 */
const classifySingleColumn = (col, sampleValues = []) => {
  return classifyColumn(col, sampleValues);
};

module.exports = {
  classifyColumns,
  classifySingleColumn,
  classifyColumn,
  SEMANTIC_ROLES
};
