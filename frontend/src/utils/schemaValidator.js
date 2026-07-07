// Helpers for checking formats
const isEmailString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.toString().trim());
};

const isPhoneString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return /^\+?[\d\s\-()]{7,20}$/.test(val.toString().trim());
};

const isNumericString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const clean = val.toString().replace(/[\$,%]/g, '').trim();
  if (clean === '') return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

const isCurrencyString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  const clean = str.replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9,\s]/g, '');
  if (clean === '' || clean === str) return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

const isPercentageString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  if (!str.endsWith('%')) return false;
  const clean = str.slice(0, -1).trim();
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

const isDateString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  if (/^\d{1,4}$/.test(str)) return false; // exclude simple years or short numbers
  const time = Date.parse(str);
  return !isNaN(time);
};

const isBooleanString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim().toLowerCase();
  return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(str);
};

/**
 * Normalizes headers just like backend sanitizeHeaders
 */
export const sanitizeHeaders = (rawHeaders) => {
  const seen = {};
  return rawHeaders
    .map(h => (h || '').toString().trim())
    .filter(h => h.length > 0)
    .map(h => {
      let candidate = h.replace(/[^a-zA-Z0-9_ ]/g, ''); // strip weird chars
      if (!candidate) candidate = 'column';
      if (seen[candidate] !== undefined) {
        seen[candidate] += 1;
        candidate = `${candidate}_${seen[candidate]}`;
      } else {
        seen[candidate] = 0;
      }
      return candidate;
    });
};

/**
 * Automatically detects column types from dataset rows
 */
export const detectColumnTypes = (rows, headers) => {
  const columnTypes = {};
  const sampleCount = Math.min(rows.length, 100);

  headers.forEach(col => {
    const values = rows
      .slice(0, sampleCount)
      .map(r => r[col])
      .filter(v => v !== null && v !== undefined && v !== '');

    if (values.length === 0) {
      columnTypes[col] = 'Text';
      return;
    }

    let emailCount = 0;
    let phoneCount = 0;
    let currencyCount = 0;
    let percentageCount = 0;
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    values.forEach(v => {
      if (isEmailString(v)) emailCount++;
      if (isPhoneString(v)) phoneCount++;
      if (isCurrencyString(v)) currencyCount++;
      if (isPercentageString(v)) percentageCount++;
      if (isNumericString(v)) numericCount++;
      if (isDateString(v)) dateCount++;
      if (isBooleanString(v)) booleanCount++;
    });

    const threshold = 0.8; // 80% match threshold
    const valLength = values.length;

    if (emailCount / valLength >= threshold) {
      columnTypes[col] = 'Email';
    } else if (phoneCount / valLength >= threshold) {
      columnTypes[col] = 'Phone Number';
    } else if (currencyCount / valLength >= threshold) {
      columnTypes[col] = 'Currency';
    } else if (percentageCount / valLength >= threshold) {
      columnTypes[col] = 'Percentage';
    } else if (numericCount / valLength >= threshold) {
      columnTypes[col] = 'Number';
    } else if (dateCount / valLength >= threshold) {
      columnTypes[col] = 'Date';
    } else if (booleanCount / valLength >= threshold) {
      columnTypes[col] = 'Boolean';
    } else {
      // Check cardinality for Categorical
      const uniqueValues = new Set(values);
      if (uniqueValues.size <= 20 || (uniqueValues.size / rows.length) <= 0.15) {
        columnTypes[col] = 'Category';
      } else {
        columnTypes[col] = 'Text';
      }
    }
  });

  return columnTypes;
};

/**
 * Validates dataset rows against headers and detected column types
 */
export const validateDataset = (rows, headers, columnTypes) => {
  const errors = [];

  // 1. Check for duplicate headers (before sanitization)
  // (In practice, headers given to this function are already unique because of object key parsing,
  // but if the user uploaded duplicates we can identify them from original file headers if we want)

  // 2. Row level validations
  rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 2; // 1-indexed, +1 for header row

    headers.forEach(col => {
      const val = row[col];
      const type = columnTypes[col];

      // Missing value validation
      if (val === null || val === undefined || val.toString().trim() === '') {
        // We log missing values as advisory validation warnings
        errors.push({
          row: rowNum,
          column: col,
          value: '',
          type: 'Missing Value',
          message: `Value in column '${col}' is missing`
        });
        return;
      }

      // Check mixed data types / invalid values
      let isInvalid = false;
      let errorType = 'Type Mismatch';
      let expected = '';

      if (type === 'Number' && !isNumericString(val)) {
        isInvalid = true;
        expected = 'a number';
      } else if (type === 'Currency' && !isCurrencyString(val) && !isNumericString(val)) {
        isInvalid = true;
        expected = 'a currency formatted string';
      } else if (type === 'Percentage' && !isPercentageString(val) && !isNumericString(val)) {
        isInvalid = true;
        expected = 'a percentage (e.g. 50%)';
      } else if (type === 'Date' && !isDateString(val)) {
        isInvalid = true;
        errorType = 'Invalid Date';
        expected = 'a valid date';
      } else if (type === 'Boolean' && !isBooleanString(val)) {
        isInvalid = true;
        expected = 'a boolean value (true/false, yes/no)';
      } else if (type === 'Email' && !isEmailString(val)) {
        isInvalid = true;
        expected = 'a valid email address';
      } else if (type === 'Phone Number' && !isPhoneString(val)) {
        isInvalid = true;
        expected = 'a valid phone number';
      }

      if (isInvalid) {
        errors.push({
          row: rowNum,
          column: col,
          value: val.toString(),
          type: errorType,
          message: `Value '${val}' does not match inferred column type '${type}' (expected ${expected})`
        });
      }
    });
  });

  return errors;
};

/**
 * Calculates dataset statistics and estimated memory
 */
export const calculateSummary = (file, rows, headers, errors, sheetName = null) => {
  // Duplicate rows detection
  const seenRows = new Set();
  let duplicateRowCount = 0;
  rows.forEach(r => {
    const str = JSON.stringify(r);
    if (seenRows.has(str)) {
      duplicateRowCount++;
    } else {
      seenRows.add(str);
    }
  });

  // Duplicate columns detection (based on lowercase trim headers)
  const seenCols = new Set();
  let duplicateColCount = 0;
  headers.forEach(h => {
    const clean = h.toLowerCase().trim();
    if (seenCols.has(clean)) {
      duplicateColCount++;
    } else {
      seenCols.add(clean);
    }
  });

  // Missing values count
  const missingValuesCount = errors.filter(e => e.type === 'Missing Value').length;

  // Estimated memory usage in bytes (stringified char is 2 bytes in JS)
  const stringLength = JSON.stringify(rows).length;
  const estimatedMemoryBytes = stringLength * 2;

  return {
    rowsCount: rows.length,
    columnsCount: headers.length,
    missingValuesCount,
    duplicateRowCount,
    duplicateColCount,
    fileSize: file ? file.size : stringLength, // raw file size in bytes
    sheetName: sheetName || 'N/A',
    estimatedMemoryBytes
  };
};
