const {
  detectBoolean,
  detectDate,
  detectCurrency,
  detectPercentage,
  detectNumeric
} = require('./detectors/typeDetectors');
const {
  detectDuplicateRows,
  detectDuplicateColumns
} = require('./detectors/duplicateDetector');
const {
  detectMissingValues
} = require('./detectors/missingValueDetector');

/**
 * Extracts and returns a structured metadata object for a parsed dataset.
 *
 * @param {Array<Object>} rows - The row objects of the parsed dataset.
 * @param {Array<string>} [headers] - The column header names. If not provided, inferred from keys of the first row.
 * @returns {Object} The structured metadata object containing profiles of columns, duplicate counts, and sample rows.
 */
const extractMetadata = (rows, headers) => {
  const datasetRows = Array.isArray(rows) ? rows : [];
  let datasetHeaders = Array.isArray(headers) ? headers : [];

  if (datasetHeaders.length === 0 && datasetRows.length > 0) {
    datasetHeaders = Object.keys(datasetRows[0]);
  }

  const rowCount = datasetRows.length;
  const columnCount = datasetHeaders.length;

  const columns = datasetHeaders.map(col => {
    const columnValues = datasetRows.map(row => row[col]);
    const nonNullValues = columnValues.filter(val => val !== null && val !== undefined && !(typeof val === 'string' && val.trim() === ''));

    // 1. Calculate missing values
    const { count: missingValueCount, percent: missingValuePercent } = detectMissingValues(datasetRows, col);

    // 2. Calculate unique values (treating Dates by timestamp value for correct Set deduplication)
    const uniqueValues = new Set(nonNullValues.map(v => v instanceof Date ? v.getTime() : v));
    const uniqueValueCount = uniqueValues.size;

    // 3. Infer Type (Deterministic rules)
    let inferredType = 'text';
    let isNumeric = false;
    let isDate = false;
    let isBoolean = false;
    let isCurrencyLike = false;
    let isPercentageLike = false;
    let isText = true;

    if (nonNullValues.length > 0) {
      const isBoolCol = detectBoolean(columnValues);
      const isDateCol = detectDate(columnValues);
      const isCurrCol = detectCurrency(columnValues, col);
      const isPctCol = detectPercentage(columnValues, col);
      const isNumCol = detectNumeric(columnValues);

      if (isBoolCol) {
        inferredType = 'boolean';
        isBoolean = true;
        isText = false;
      } else if (isDateCol) {
        inferredType = 'date';
        isDate = true;
        isText = false;
      } else if (isCurrCol) {
        inferredType = 'currency';
        isCurrencyLike = true;
        isText = false;
      } else if (isPctCol) {
        inferredType = 'percentage';
        isPercentageLike = true;
        isText = false;
      } else if (isNumCol) {
        inferredType = 'numeric';
        isNumeric = true;
        isText = false;
      }
    }

    return {
      name: col,
      inferredType,
      isNumeric,
      isDate,
      isBoolean,
      isCurrencyLike,
      isPercentageLike,
      isText,
      uniqueValueCount,
      missingValueCount,
      missingValuePercent
    };
  });

  // Calculate duplicates
  const duplicateRowCount = detectDuplicateRows(datasetRows, datasetHeaders);
  const duplicateColumnNames = detectDuplicateColumns(datasetRows, datasetHeaders);

  // Sample rows (first 5, unmodified)
  const sampleRows = datasetRows.slice(0, 5);

  return {
    rowCount,
    columnCount,
    columns,
    duplicateRowCount,
    duplicateColumnNames,
    sampleRows
  };
};

module.exports = {
  extractMetadata
};
