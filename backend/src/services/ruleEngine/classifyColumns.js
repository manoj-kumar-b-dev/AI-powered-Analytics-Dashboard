const { isIdentifier } = require('./rules/identifierRules');
const { checkIgnoreRules } = require('./rules/ignoreRules');
const { classifyRole } = require('./rules/roleRules');

/**
 * Classifies each column in the dataset metadata using deterministic heuristic rules.
 *
 * @param {Object} metadata - The metadata object returned by Phase 2 (Metadata Extraction Engine).
 * @returns {Array<Object>} An array of classification objects for each column.
 */
const classifyColumns = (metadata) => {
  if (!metadata || !Array.isArray(metadata.columns)) {
    return [];
  }

  const { columns, sampleRows, rowCount } = metadata;
  const samples = Array.isArray(sampleRows) ? sampleRows : [];

  return columns.map(col => {
    const columnName = col.name;
    // Map sampleValues from sampleRows
    const sampleValues = samples.map(row => row[columnName]);

    // Rule 1: Check Identifiers (e.g. ID, uuid, order_id)
    const identResult = isIdentifier(columnName, sampleValues);
    if (identResult.isMatch) {
      return {
        columnName,
        detectedType: identResult.detectedType,
        businessRole: identResult.businessRole,
        confidence: identResult.confidence,
        reason: identResult.reason,
        needsReview: identResult.confidence < 0.6
      };
    }

    // Rule 2: Check Ignore criteria (emails, phone numbers, URLs, addresses)
    // Only run on 'text' type columns to prevent false positives on dates/numbers
    if (col.inferredType === 'text') {
      const ignoreResult = checkIgnoreRules(columnName, sampleValues);
      if (ignoreResult.isMatch) {
        return {
          columnName,
          detectedType: ignoreResult.detectedType,
          businessRole: ignoreResult.businessRole,
          confidence: ignoreResult.confidence,
          reason: ignoreResult.reason,
          needsReview: ignoreResult.confidence < 0.6
        };
      }
    }

    // Rule 3: Dimension vs Metric vs High Cardinality fallback
    const roleResult = classifyRole(col, sampleValues, rowCount);
    const finalConfidence = roleResult.confidence;
    const needsReview = roleResult.needsReview || finalConfidence < 0.6;

    return {
      columnName,
      detectedType: roleResult.detectedType,
      businessRole: roleResult.businessRole,
      confidence: finalConfidence,
      reason: roleResult.reason,
      needsReview
    };
  });
};

module.exports = {
  classifyColumns
};
