/**
 * Counts the number of duplicate rows in the dataset.
 * A row is a duplicate if its values across all headers are identical to a previous row.
 */
const detectDuplicateRows = (rows, headers) => {
  if (!rows || rows.length === 0 || !headers || headers.length === 0) {
    return 0;
  }
  const seen = new Set();
  let duplicateCount = 0;
  for (const row of rows) {
    // Standardize representation of cells to be stringify-safe
    const rowValues = headers.map(h => {
      const val = row[h];
      if (val instanceof Date) return val.getTime();
      return val;
    });
    const serialized = JSON.stringify(rowValues);
    if (seen.has(serialized)) {
      duplicateCount++;
    } else {
      seen.add(serialized);
    }
  }
  return duplicateCount;
};

/**
 * Detects columns that are identical to a prior column across all rows.
 * Returns the names of these duplicate columns.
 */
const detectDuplicateColumns = (rows, headers) => {
  if (!rows || rows.length === 0 || !headers || headers.length === 0) {
    return [];
  }
  const duplicateColumnNames = [];
  for (let i = 0; i < headers.length; i++) {
    const colA = headers[i];
    let isDuplicate = false;
    for (let j = 0; j < i; j++) {
      const colB = headers[j];
      let match = true;
      for (const row of rows) {
        const valA = row[colA];
        const valB = row[colB];
        if (valA instanceof Date && valB instanceof Date) {
          if (valA.getTime() !== valB.getTime()) {
            match = false;
            break;
          }
        } else if (valA !== valB) {
          match = false;
          break;
        }
      }
      if (match) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) {
      duplicateColumnNames.push(colA);
    }
  }
  return duplicateColumnNames;
};

module.exports = {
  detectDuplicateRows,
  detectDuplicateColumns
};
