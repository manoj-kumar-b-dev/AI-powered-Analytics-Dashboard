const { EMAIL_PATTERN, PHONE_PATTERN, URL_PATTERN } = require('../../../utils/patterns');

/**
 * Checks if a column matches "ignore" patterns such as emails, phone numbers, URLs, or addresses.
 *
 * @param {string} columnName - The name of the column.
 * @param {Array} sampleValues - A sample of values from the column.
 * @returns {Object} Result indicating if the column matches an ignore category, detectedType, confidence, and reason.
 */
const checkIgnoreRules = (columnName, sampleValues) => {
  const nonNullSamples = sampleValues.filter(val => val !== null && val !== undefined && !(typeof val === 'string' && val.trim() === ''));

  if (nonNullSamples.length === 0) {
    return { isMatch: false };
  }

  // 1. Emails
  let emailCount = 0;
  for (const val of nonNullSamples) {
    if (EMAIL_PATTERN.test(val.toString())) {
      emailCount++;
    }
  }
  if ((emailCount / nonNullSamples.length) > 0.8) {
    return {
      isMatch: true,
      detectedType: 'text',
      businessRole: 'ignore',
      confidence: 0.9,
      reason: 'Values match email pattern in >80% of rows'
    };
  }

  // 2. Phone Numbers
  let phoneCount = 0;
  for (const val of nonNullSamples) {
    if (PHONE_PATTERN.test(val.toString())) {
      phoneCount++;
    }
  }
  if ((phoneCount / nonNullSamples.length) > 0.8) {
    return {
      isMatch: true,
      detectedType: 'text',
      businessRole: 'ignore',
      confidence: 0.9,
      reason: 'Values match phone pattern in >80% of rows'
    };
  }

  // 3. URLs
  let urlCount = 0;
  for (const val of nonNullSamples) {
    if (URL_PATTERN.test(val.toString())) {
      urlCount++;
    }
  }
  if ((urlCount / nonNullSamples.length) > 0.8) {
    return {
      isMatch: true,
      detectedType: 'text',
      businessRole: 'ignore',
      confidence: 0.9,
      reason: 'Values match URL/domain pattern in >80% of rows'
    };
  }

  // 4. Addresses / Zipcodes
  const isAddressName = /address|street|city|zipcode|postal/i.test(columnName);
  if (isAddressName) {
    const allStrings = nonNullSamples.every(val => typeof val === 'string' || typeof val === 'number');
    const totalLength = nonNullSamples.reduce((sum, val) => sum + val.toString().length, 0);
    const avgLength = totalLength / nonNullSamples.length;
    if (allStrings && avgLength >= 2) {
      return {
        isMatch: true,
        detectedType: 'text',
        businessRole: 'ignore',
        confidence: 0.85,
        reason: `Column name "${columnName}" matches address/location pattern and values are text/digits`
      };
    }
  }

  return { isMatch: false };
};

module.exports = {
  checkIgnoreRules
};
