const { ID_SUFFIX_PATTERN, ID_EXACT_PATTERN } = require('../../../utils/patterns');

/**
 * Checks if a column represents a unique identifier.
 *
 * @param {string} columnName - The name of the column.
 * @param {Array} sampleValues - A sample of values from the column.
 * @returns {Object} Result indicating if the column is an identifier, the confidence, and the reason.
 */
const isIdentifier = (columnName, sampleValues) => {
  const exactMatch = ID_EXACT_PATTERN.test(columnName);
  const suffixMatch = ID_SUFFIX_PATTERN.test(columnName);
  const specificMatch = /^(customer_id|order_id|invoice_id|employee_id)$/i.test(columnName);

  if (exactMatch || suffixMatch || specificMatch) {
    return {
      isMatch: true,
      detectedType: 'identifier',
      businessRole: 'identifier',
      confidence: 0.95,
      reason: `Column name "${columnName}" matches identifier pattern (${exactMatch ? 'exact match' : specificMatch ? 'specific pattern' : 'suffix match'})`
    };
  }

  return { isMatch: false };
};

module.exports = {
  isIdentifier
};
