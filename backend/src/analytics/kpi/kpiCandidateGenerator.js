/**
 * KPI Candidate Generator
 *
 * Generates business-relevant KPI candidates using:
 *   1. Domain profile templates (configuration-driven)
 *   2. Semantic column classification (to verify column existence and type compatibility)
 *   3. Aggregation compatibility validation (to ensure no invalid aggregations)
 *
 * Every candidate returned is guaranteed to:
 *   - Reference columns that actually exist in the dataset
 *   - Use only semantically valid aggregations
 *   - Have a business reason
 *
 * This module does NOT call the AI. AI enrichment happens in recommendationPipeline.js.
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { validateAggregation, isExcludedFromKPI, normalizeAggregation, AGGREGATIONS } = require('../aggregation/aggregationRules');
const { getDomainProfile } = require('../domain/domainProfiles');

// ---------------------------------------------------------------------------
// Helper: find the best matching column for a KPI template
// ---------------------------------------------------------------------------

/**
 * Given a KPI template and a semantic column map, find the best matching column.
 *
 * Matching priority:
 * 1. Column name matches one of the preferredColumnPatterns
 * 2. Column has one of the requiredSemanticRoles
 *
 * @param {Object} template - KPI template from domain profile
 * @param {Map<string, Object>} columnSemantics - Map from classifyColumns()
 * @returns {{ column: string, semanticRole: string } | null}
 */
const findBestColumn = (template, columnSemantics) => {
  const { requiredSemanticRoles = [], preferredColumnPatterns = [] } = template;

  // Flatten required roles: at least one OR-group must match
  // requiredSemanticRoles is an array of OR-groups (arrays)
  // We need a column that satisfies at least the FIRST OR-group (primary requirement)

  // Collect all columns by semantic role
  const roleToColumns = new Map();
  for (const [colName, semantics] of columnSemantics.entries()) {
    const role = semantics.semanticRole;
    if (!roleToColumns.has(role)) {
      roleToColumns.set(role, []);
    }
    roleToColumns.get(role).push(colName);
  }

  // Flatten all required roles from all groups
  const allRequiredRoles = new Set(requiredSemanticRoles.flat());

  // First pass: prefer columns that match both the pattern AND required role
  for (const pattern of preferredColumnPatterns) {
    for (const [colName, semantics] of columnSemantics.entries()) {
      if (pattern.test(colName) && allRequiredRoles.has(semantics.semanticRole)) {
        return { column: colName, semanticRole: semantics.semanticRole };
      }
    }
  }

  // Second pass: any column matching the pattern (even if role doesn't match exactly)
  for (const pattern of preferredColumnPatterns) {
    for (const [colName, semantics] of columnSemantics.entries()) {
      if (pattern.test(colName) && !isExcludedFromKPI(semantics.semanticRole)) {
        return { column: colName, semanticRole: semantics.semanticRole };
      }
    }
  }

  // Third pass: first column with a matching required semantic role
  for (const orGroup of requiredSemanticRoles) {
    for (const role of orGroup) {
      const cols = roleToColumns.get(role) || [];
      if (cols.length > 0) {
        return { column: cols[0], semanticRole: role };
      }
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Candidate generator
// ---------------------------------------------------------------------------

/**
 * Generates KPI candidates for a given dataset domain and semantic column map.
 *
 * @param {string} domain - Dataset domain (e.g., 'hr', 'sales')
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @param {Array} schema - Full schema array for column existence verification
 * @returns {Array<Object>} Array of validated KPI candidates
 */
const generateKPICandidates = (domain, columnSemantics, schema) => {
  const profile = getDomainProfile(domain);
  const candidates = [];
  const usedColumns = new Set(); // prevent same column used for two different KPIs

  for (const template of (profile.kpiTemplates || [])) {
    // Skip computed KPIs for now (e.g. attrition rate needs post-processing)
    // They will be handled with special logic if their required columns exist
    const match = findBestColumn(template, columnSemantics);

    if (!match) {
      console.log(`[KPICandidateGenerator] Skipping KPI "${template.title}" — no matching column found for domain "${domain}"`);
      continue;
    }

    const { column, semanticRole } = match;

    // Prevent the same column from being mapped to multiple KPIs
    // (unless the KPI is computed from a dimension like status)
    if (usedColumns.has(column) && template.aggregation !== AGGREGATIONS.COUNT) {
      // Allow count-based KPIs to reuse columns (e.g. count active employees uses same status column)
      continue;
    }

    // Validate aggregation
    const aggNorm = normalizeAggregation(template.aggregation);
    const validation = validateAggregation(semanticRole, aggNorm);

    if (!validation.valid) {
      console.warn(`[KPICandidateGenerator] Skipping KPI "${template.title}" — aggregation "${aggNorm}" is invalid for role "${semanticRole}": ${validation.reason}`);
      continue;
    }

    // Mark column as used (only for non-count, non-dimension aggregations)
    if (aggNorm !== AGGREGATIONS.COUNT && aggNorm !== AGGREGATIONS.COUNT_DISTINCT) {
      usedColumns.add(column);
    }

    candidates.push({
      id: template.id,
      title: template.title,
      description: template.description || '',
      column,
      semanticRole,
      aggregation: aggNorm,
      format: template.format || 'number',
      icon: template.icon || 'Activity',
      color: template.color || 'blue',
      priority: template.priority || 'secondary',
      domainRelevance: template.domainRelevance || 70,
      filterCondition: template.filterCondition || null,
      businessReason: `${template.title} is a key ${domain.toUpperCase()} metric. Column "${column}" (${semanticRole}) with ${aggNorm} provides meaningful business value.`,
      source: 'domain_profile'
    });
  }

  return candidates;
};

/**
 * Validates a KPI candidate from an external source (e.g. AI recommendation).
 * Returns null if the candidate is invalid.
 *
 * @param {Object} candidate - KPI candidate (must have column, aggregation, and title)
 * @param {Map<string, Object>} columnSemantics - From semanticClassifier.classifyColumns()
 * @returns {Object|null} Validated candidate or null
 */
const validateExternalKPICandidate = (candidate, columnSemantics) => {
  if (!candidate || !candidate.column || !candidate.aggregation) {
    return null;
  }

  const semantics = columnSemantics.get(candidate.column);
  if (!semantics) {
    console.warn(`[KPICandidateGenerator] External KPI "${candidate.title}" rejected — column "${candidate.column}" not found in schema`);
    return null;
  }

  const { semanticRole } = semantics;

  if (isExcludedFromKPI(semanticRole)) {
    console.warn(`[KPICandidateGenerator] External KPI "${candidate.title}" rejected — semantic role "${semanticRole}" is excluded from KPI analysis`);
    return null;
  }

  const aggNorm = normalizeAggregation(candidate.aggregation);
  const validation = validateAggregation(semanticRole, aggNorm);

  if (!validation.valid) {
    console.warn(`[KPICandidateGenerator] External KPI "${candidate.title}" rejected — ${validation.reason}`);
    return null;
  }

  return {
    ...candidate,
    semanticRole,
    aggregation: aggNorm,
    source: candidate.source || 'external'
  };
};

module.exports = {
  generateKPICandidates,
  validateExternalKPICandidate,
  findBestColumn
};
