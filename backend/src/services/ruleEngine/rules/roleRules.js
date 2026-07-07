/**
 * Classifies a column as a dimension, metric, or high-cardinality ignore fallback.
 *
 * @param {Object} column - The column metadata from Phase 2.
 * @param {Array} sampleValues - A sample of values from the column.
 * @param {number} rowCount - The total row count of the dataset.
 * @returns {Object} The classification result including businessRole, detectedType, confidence, reason, and needsReview if applicable.
 */
const classifyRole = (column, sampleValues, rowCount) => {
  const { name, inferredType, uniqueValueCount } = column;

  if (['numeric', 'currency', 'percentage'].includes(inferredType)) {
    // Check if it is ambiguous (only for generic 'numeric' type, and with low unique values)
    const isAmbiguous = inferredType === 'numeric' && uniqueValueCount > 0 && uniqueValueCount < 20;
    const confidence = isAmbiguous ? 0.55 : 0.9;
    const reason = isAmbiguous
      ? `Numeric column "${name}" has low cardinality (${uniqueValueCount} unique values); could be a rating/score category or discrete metric.`
      : `Numeric column "${name}" classified as metric based on type "${inferredType}"`;

    return {
      detectedType: inferredType,
      businessRole: 'metric',
      confidence,
      reason,
      needsReview: isAmbiguous
    };
  }

  // 2. Dimension: date, boolean, or category (low unique-value-count text)
  if (inferredType === 'date' || inferredType === 'boolean') {
    return {
      detectedType: inferredType,
      businessRole: 'dimension',
      confidence: 0.95,
      reason: `Column "${name}" classified as dimension based on type "${inferredType}"`
    };
  }

  // Check for category classification (low cardinality text)
  if (inferredType === 'text') {
    const isLowCardinality = uniqueValueCount < 20 || (rowCount > 0 && (uniqueValueCount / rowCount) < 0.05);
    if (isLowCardinality) {
      return {
        detectedType: 'category',
        businessRole: 'dimension',
        confidence: 0.85,
        reason: `Text column "${name}" has low cardinality (${uniqueValueCount} unique values), classified as categorical dimension`
      };
    }

    // High cardinality text -> treat as ignore
    return {
      detectedType: 'text',
      businessRole: 'ignore',
      confidence: 0.45,
      reason: `High cardinality text column "${name}" (${uniqueValueCount} unique values), flagged for manual review`,
      needsReview: true
    };
  }

  // Fallback
  return {
    detectedType: 'text',
    businessRole: 'ignore',
    confidence: 0.3,
    reason: `Unknown metadata pattern for column "${name}"`,
    needsReview: true
  };
};

module.exports = {
  classifyRole
};
