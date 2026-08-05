/**
 * Chart Candidate Generator
 *
 * Generates semantically valid chart candidates using:
 *   1. Domain profile chart templates
 *   2. Semantic column classifications
 *   3. Aggregation compatibility validation
 *
 * CRITICAL GUARANTEE: No chart is generated where:
 *   - SUM is applied to Age, Performance_Rating, Attendance_%, or any non-additive column
 *   - AVG or SUM is applied to identifiers or categorical dimensions
 *   - The dimension column does not exist in the dataset
 *   - The metric column does not exist in the dataset
 *
 * This module does NOT call the AI. AI enrichment happens in recommendationPipeline.js.
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { validateAggregation, isExcludedFromAnalytics, normalizeAggregation, getPreferredAggregation, AGGREGATIONS } = require('../aggregation/aggregationRules');
const { getDomainProfile } = require('../domain/domainProfiles');

// Valid chart types
const VALID_CHART_TYPES = new Set(['line', 'bar', 'pie', 'scatter', 'area']);

// Roles that can serve as the X-axis (dimension/grouping)
const DIMENSION_ROLES = new Set([
  SEMANTIC_ROLES.CATEGORICAL_DIMENSION,
  SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION,
  SEMANTIC_ROLES.STATUS_DIMENSION,
  SEMANTIC_ROLES.TEMPORAL_DIMENSION,
  SEMANTIC_ROLES.ORDINAL_METRIC  // ordinal can be used as category axis (e.g. rating distribution)
]);

// Roles that can serve as the Y-axis (metric to aggregate)
const METRIC_ROLES = new Set([
  SEMANTIC_ROLES.MONETARY_METRIC,
  SEMANTIC_ROLES.ADDITIVE_METRIC,
  SEMANTIC_ROLES.PERCENTAGE_METRIC,
  SEMANTIC_ROLES.ORDINAL_METRIC,
  SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE,
  SEMANTIC_ROLES.RATIO_METRIC
]);

// ---------------------------------------------------------------------------
// Helper: find columns matching a set of semantic roles and name patterns
// ---------------------------------------------------------------------------

/**
 * @param {Set<string>} roleSet - Acceptable semantic roles
 * @param {RegExp[]} [preferredPatterns] - Preferred column name patterns
 * @param {Map<string, Object>} columnSemantics
 * @returns {string|null} Best matching column name
 */
const findColumnForRole = (roleSet, preferredPatterns = [], columnSemantics) => {
  // First: prefer columns matching both pattern and role
  if (preferredPatterns.length > 0) {
    for (const pattern of preferredPatterns) {
      for (const [colName, semantics] of columnSemantics.entries()) {
        if (pattern.test(colName) && roleSet.has(semantics.semanticRole)) {
          return colName;
        }
      }
    }
    // Second: any column matching the pattern
    for (const pattern of preferredPatterns) {
      for (const [colName] of columnSemantics.entries()) {
        if (pattern.test(colName)) {
          return colName;
        }
      }
    }
  }

  // Third: first column with matching role
  for (const [colName, semantics] of columnSemantics.entries()) {
    if (roleSet.has(semantics.semanticRole)) {
      return colName;
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Chart candidate generators
// ---------------------------------------------------------------------------

/**
 * Generates chart candidates from domain profile templates.
 *
 * @param {string} domain
 * @param {Map<string, Object>} columnSemantics
 * @returns {Array<Object>}
 */
const generateChartCandidates = (domain, columnSemantics) => {
  const profile = getDomainProfile(domain);
  const candidates = [];

  for (const template of (profile.chartTemplates || [])) {
    // Find X-axis column
    const xRoleSet = new Set(template.xSemanticRoles || []);
    const xColumn = findColumnForRole(
      xRoleSet,
      template.xPreferredPatterns || [],
      columnSemantics
    );

    if (!xColumn) {
      console.log(`[ChartCandidateGenerator] Skipping chart "${template.title}" — no X-axis column found`);
      continue;
    }

    const xSemantics = columnSemantics.get(xColumn);
    const xRole = xSemantics?.semanticRole;

    // Determine Y-axis
    let yColumn = null;
    let yRole = null;
    let aggregation = normalizeAggregation(template.aggregation || AGGREGATIONS.COUNT);

    if (template.yMetric === 'count') {
      // Count-based chart: Y is always count, no yColumn needed
      yColumn = '_count';
      yRole = null;
      aggregation = AGGREGATIONS.COUNT;
    } else if (template.ySemanticRoles && template.ySemanticRoles.length > 0) {
      const yRoleSet = new Set(template.ySemanticRoles);
      yColumn = findColumnForRole(
        yRoleSet,
        template.yPreferredPatterns || [],
        columnSemantics
      );

      if (!yColumn) {
        console.log(`[ChartCandidateGenerator] Skipping chart "${template.title}" — no Y-axis column found`);
        continue;
      }

      yRole = columnSemantics.get(yColumn)?.semanticRole;

      // Validate aggregation against Y column's semantic role
      const validation = validateAggregation(yRole, aggregation);
      if (!validation.valid) {
        // Try suggested aggregation
        aggregation = validation.suggestedAggregation || getPreferredAggregation(yRole);
        const revalidation = validateAggregation(yRole, aggregation);
        if (!revalidation.valid) {
          console.warn(`[ChartCandidateGenerator] Skipping chart "${template.title}" — cannot find valid aggregation for Y-axis role "${yRole}"`);
          continue;
        }
      }
    } else {
      // No Y-axis defined — skip
      continue;
    }

    // Ensure X-axis column is not excluded from analytics
    if (isExcludedFromAnalytics(xRole)) {
      console.warn(`[ChartCandidateGenerator] Skipping chart "${template.title}" — X-axis column "${xColumn}" is excluded from analytics`);
      continue;
    }

    // Ensure Y-axis column (if not count) is not excluded
    if (yColumn !== '_count' && yRole && isExcludedFromAnalytics(yRole)) {
      console.warn(`[ChartCandidateGenerator] Skipping chart "${template.title}" — Y-axis column "${yColumn}" is excluded from analytics`);
      continue;
    }

    candidates.push({
      id: template.id,
      title: template.title,
      chartType: template.chartType || 'bar',
      xField: xColumn,
      yField: yColumn,
      aggregation,
      xSemanticRole: xRole,
      ySemanticRole: yRole,
      priority: template.priority || 'secondary',
      businessReason: template.businessReason || `${template.title} visualization for ${domain} domain.`,
      source: 'domain_profile'
    });
  }

  return candidates;
};

/**
 * Validates a chart candidate from an external source (AI or fallback).
 * Returns null if semantically invalid.
 *
 * @param {Object} candidate - { chartType, xField, yField, aggregation, title }
 * @param {Map<string, Object>} columnSemantics
 * @returns {Object|null} Validated candidate or null
 */
const validateExternalChartCandidate = (candidate, columnSemantics) => {
  if (!candidate || !candidate.xField || !candidate.chartType) {
    return null;
  }

  if (!VALID_CHART_TYPES.has((candidate.chartType || '').toLowerCase())) {
    console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" rejected — invalid chart type "${candidate.chartType}"`);
    return null;
  }

  // Validate X-axis
  const xSemantics = columnSemantics.get(candidate.xField);
  if (!xSemantics) {
    console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" rejected — xField "${candidate.xField}" not in schema`);
    return null;
  }

  if (isExcludedFromAnalytics(xSemantics.semanticRole)) {
    console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" rejected — xField "${candidate.xField}" is contact/sensitive data`);
    return null;
  }

  // Validate Y-axis and aggregation
  const yField = candidate.yField;
  let aggNorm = normalizeAggregation(candidate.aggregation || AGGREGATIONS.COUNT);

  if (yField && yField !== '_count') {
    const ySemantics = columnSemantics.get(yField);
    if (!ySemantics) {
      console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" rejected — yField "${yField}" not in schema`);
      return null;
    }

    if (isExcludedFromAnalytics(ySemantics.semanticRole)) {
      console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" rejected — yField "${yField}" is contact/sensitive data`);
      return null;
    }

    const validation = validateAggregation(ySemantics.semanticRole, aggNorm);
    if (!validation.valid) {
      console.warn(`[ChartCandidateGenerator] External chart "${candidate.title}" aggregation "${aggNorm}" rejected for role "${ySemantics.semanticRole}": ${validation.reason}. Trying suggested: ${validation.suggestedAggregation}`);

      // Try the suggested aggregation before rejecting
      if (validation.suggestedAggregation) {
        const revalidation = validateAggregation(ySemantics.semanticRole, validation.suggestedAggregation);
        if (revalidation.valid) {
          aggNorm = validation.suggestedAggregation;
          console.log(`[ChartCandidateGenerator] External chart "${candidate.title}" aggregation corrected to "${aggNorm}"`);
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    return {
      ...candidate,
      yField,
      aggregation: aggNorm,
      xSemanticRole: xSemantics.semanticRole,
      ySemanticRole: ySemantics.semanticRole,
      source: candidate.source || 'external'
    };
  }

  // Count-based chart (yField = '_count')
  return {
    ...candidate,
    yField: yField || '_count',
    aggregation: AGGREGATIONS.COUNT,
    xSemanticRole: xSemantics.semanticRole,
    source: candidate.source || 'external'
  };
};

module.exports = {
  generateChartCandidates,
  validateExternalChartCandidate,
  DIMENSION_ROLES,
  METRIC_ROLES
};
