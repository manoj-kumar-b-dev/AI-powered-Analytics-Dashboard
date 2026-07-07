/**
 * Counts missing values (null, undefined, or empty/whitespace string)
 * for a column and calculates the missing percentage relative to row count.
 */
const detectMissingValues = (rows, columnName) => {
  if (!rows || rows.length === 0) {
    return { count: 0, percent: 0 };
  }
  let count = 0;
  for (const row of rows) {
    const val = row[columnName];
    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
      count++;
    }
  }
  const percent = (count / rows.length) * 100;
  return { count, percent };
};

module.exports = {
  detectMissingValues
};
