const isDateValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'boolean') return false;
  if (typeof val === 'number') return false;

  const str = val.toString().trim();
  // Exclude simple digit patterns or percentage/currency symbols
  if (/^\d+$/.test(str)) return false;
  if (/[%$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9]/.test(str)) return false;

  // acceptable patterns:
  // A. Number separated by slash/dash/dot
  const separatorPattern = /^\d{1,4}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{1,4})?$/;
  // B. ISO timestamp
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  // C. Month name
  const monthNames = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
  const hasMonth = monthNames.test(str);

  const matchesPattern = separatorPattern.test(str) || isoPattern.test(str) || hasMonth;
  if (!matchesPattern) return false;

  // Try standard parse
  const time = Date.parse(str);
  if (!isNaN(time)) {
    const d = new Date(time);
    const y = d.getFullYear();
    if (y >= 1000 && y <= 3000) {
      return true;
    }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  }

  // Try YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  }

  return false;
};

/**
 * Checks if a single value is boolean-like (true/false, yes/no, 0/1).
 */
const isBooleanValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return val === 0 || val === 1;
  const str = val.toString().trim().toLowerCase();
  return ['true', 'false', 'yes', 'no', '0', '1'].includes(str);
};

/**
 * Checks if a single value is currency-like with symbol.
 */
const isCurrencyValueWithSymbol = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  const hasSymbol = /[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9]/.test(str);
  if (!hasSymbol) return false;

  const clean = str.replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9]/g, '').replace(/,/g, '').trim();
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

/**
 * Checks if a single value parses as numeric (possibly with currency symbol or commas stripped).
 */
const isNumericValueWithOrWithoutSymbol = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return isFinite(val) && !isNaN(val);
  const str = val.toString().trim();
  const clean = str.replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9]/g, '').replace(/,/g, '').trim();
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

/**
 * Checks if a single value is percentage-like with % suffix.
 */
const isPercentageValueWithSuffix = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  if (!str.endsWith('%')) return false;
  const clean = str.slice(0, -1).trim();
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

/**
 * Checks if a single value is numeric and between 0 and 100 (inclusive).
 */
const isNumericValueBetween0And100 = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return isFinite(val) && !isNaN(val) && val >= 0 && val <= 100;
  const str = val.toString().trim();
  const num = Number(str);
  return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
};

/**
 * Checks if a single value parses as a standard number.
 */
const isNumericValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return isFinite(val) && !isNaN(val);
  if (typeof val === 'boolean') return false;
  const clean = val.toString().replace(/,/g, '').trim();
  if (clean === '') return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

/**
 * Detects if column is Boolean (values limited to true/false, yes/no, 0/1 case-insensitive).
 */
const detectBoolean = (values) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''));
  if (nonNullValues.length === 0) return false;
  return nonNullValues.every(isBooleanValue);
};

/**
 * Detects if column is Date (>90% parses as date).
 */
const detectDate = (values) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''));
  if (nonNullValues.length === 0) return false;

  let count = 0;
  for (const val of nonNullValues) {
    if (isDateValue(val)) {
      count++;
    }
  }
  return (count / nonNullValues.length) > 0.9;
};

/**
 * Detects if column is Currency-like.
 */
const detectCurrency = (values, columnName) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''));
  if (nonNullValues.length === 0) return false;

  const isNameMatch = /price|cost|amount|revenue|salary|fee/i.test(columnName);
  if (isNameMatch) {
    let count = 0;
    for (const val of nonNullValues) {
      if (isNumericValueWithOrWithoutSymbol(val)) {
        count++;
      }
    }
    return (count / nonNullValues.length) > 0.9;
  } else {
    let count = 0;
    for (const val of nonNullValues) {
      if (isCurrencyValueWithSymbol(val)) {
        count++;
      }
    }
    return (count / nonNullValues.length) > 0.9;
  }
};

/**
 * Detects if column is Percentage-like.
 */
const detectPercentage = (values, columnName) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''));
  if (nonNullValues.length === 0) return false;

  let suffixCount = 0;
  for (const val of nonNullValues) {
    if (isPercentageValueWithSuffix(val)) {
      suffixCount++;
    }
  }
  if ((suffixCount / nonNullValues.length) > 0.9) {
    return true;
  }

  const isNameMatch = /percent|rate|%|ratio/i.test(columnName);
  if (isNameMatch) {
    let rangeCount = 0;
    for (const val of nonNullValues) {
      if (isNumericValueBetween0And100(val)) {
        rangeCount++;
      }
    }
    return (rangeCount / nonNullValues.length) > 0.9;
  }

  return false;
};

/**
 * Detects if column is Numeric (>90% parses as number).
 */
const detectNumeric = (values) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''));
  if (nonNullValues.length === 0) return false;

  let count = 0;
  for (const val of nonNullValues) {
    if (isNumericValue(val)) {
      count++;
    }
  }
  return (count / nonNullValues.length) > 0.9;
};

module.exports = {
  isDateValue,
  isBooleanValue,
  isCurrencyValueWithSymbol,
  isNumericValueWithOrWithoutSymbol,
  isPercentageValueWithSuffix,
  isNumericValueBetween0And100,
  isNumericValue,
  detectBoolean,
  detectDate,
  detectCurrency,
  detectPercentage,
  detectNumeric
};
