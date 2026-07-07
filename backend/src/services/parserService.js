const Papa = require('papaparse');
const XLSX = require('xlsx');

// Helper: Normalize Headers
const sanitizeHeaders = (rawHeaders) => {
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

// Helper: Check if string is a numeric representation
const isNumericString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const clean = val.toString().replace(/[\$,]/g, '').trim();
  if (clean === '') return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

// Helper: Check if string is an email
const isEmailString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.toString().trim());
};

// Helper: Check if string is a phone number
const isPhoneString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return /^\+?[\d\s\-()]{7,20}$/.test(val.toString().trim());
};

// Helper: Check if string is currency
const isCurrencyString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  const clean = str.replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9,\s]/g, '');
  if (clean === '' || clean === str) return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

// Helper: Check if string is percentage
const isPercentageString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  if (!str.endsWith('%')) return false;
  const clean = str.slice(0, -1).trim();
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

// Helper: Check if string is a date representation
const isDateString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  // Exclude simple short numbers (like '123' or '2025' which Date.parse can parse but are numbers)
  if (/^\d{1,4}$/.test(str)) return false;
  const time = Date.parse(str);
  return !isNaN(time);
};

// Helper: Check if string is a boolean representation
const isBooleanString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim().toLowerCase();
  return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(str);
};

// Main Schema Inference Logic
const inferSchema = (rows, headers) => {
  const schema = [];
  const totalRows = rows.length;

  headers.forEach(col => {
    // Collect non-empty values
    const values = rows
      .map(r => r[col])
      .filter(v => v !== null && v !== undefined && v !== '');

    if (values.length === 0) {
      // Default fallback if all empty
      schema.push({
        column: col,
        type: 'text',
        detectedType: 'Text',
        nullable: true,
        sampleValues: []
      });
      return;
    }

    // Determine type by checking matching ratios of values
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let emailCount = 0;
    let phoneCount = 0;
    let currencyCount = 0;
    let percentageCount = 0;

    values.forEach(v => {
      if (isNumericString(v)) numericCount++;
      if (isDateString(v)) dateCount++;
      if (isBooleanString(v)) booleanCount++;
      if (isEmailString(v)) emailCount++;
      if (isPhoneString(v)) phoneCount++;
      if (isCurrencyString(v)) currencyCount++;
      if (isPercentageString(v)) percentageCount++;
    });

    let inferredType = 'text';
    let detectedType = 'Text';
    const threshold = 0.8; // 80% match threshold for type inference

    if (emailCount / values.length >= threshold) {
      inferredType = 'text';
      detectedType = 'Email';
    } else if (phoneCount / values.length >= threshold) {
      inferredType = 'text';
      detectedType = 'Phone Number';
    } else if (currencyCount / values.length >= threshold) {
      inferredType = 'numeric';
      detectedType = 'Currency';
    } else if (percentageCount / values.length >= threshold) {
      inferredType = 'numeric';
      detectedType = 'Percentage';
    } else if (numericCount / values.length >= threshold) {
      inferredType = 'numeric';
      detectedType = 'Number';
    } else if (dateCount / values.length >= threshold) {
      inferredType = 'date';
      detectedType = 'Date';
    } else if (booleanCount / values.length >= threshold) {
      inferredType = 'boolean';
      detectedType = 'Boolean';
    } else {
      // Check cardinality for Categorical vs Text
      const uniqueValues = new Set(values);
      const cardinality = uniqueValues.size;
      
      // If low absolute unique values or low percentage of total rows, make categorical
      if (cardinality <= 20 || (cardinality / totalRows) <= 0.15) {
        inferredType = 'categorical';
        detectedType = 'Category';
      }
    }

    // Collect distinct sample values
    const distinctSamples = Array.from(new Set(values.slice(0, 100))).slice(0, 5);

    schema.push({
      column: col,
      type: inferredType,
      detectedType: detectedType,
      nullable: values.length < totalRows,
      sampleValues: distinctSamples.map(v => v.toString())
    });
  });

  return schema;
};

// Validate rows against inferred types and count mismatches
const validateRows = (rows, schema) => {
  let problemCount = 0;
  const problemSamples = [];

  rows.forEach((row, rowIndex) => {
    let rowHasProblem = false;
    const problems = [];

    schema.forEach(colSchema => {
      const val = row[colSchema.column];
      if (val === null || val === undefined || val === '') {
        return; // Nullable check is advisory
      }

      let isInvalid = false;
      if (colSchema.type === 'numeric' && !isNumericString(val)) isInvalid = true;
      if (colSchema.type === 'date' && !isDateString(val)) isInvalid = true;
      if (colSchema.type === 'boolean' && !isBooleanString(val)) isInvalid = true;

      if (isInvalid) {
        rowHasProblem = true;
        problems.push({
          column: colSchema.column,
          value: val,
          expectedType: colSchema.type
        });
      }
    });

    if (rowHasProblem) {
      problemCount++;
      if (problemSamples.length < 5) {
        problemSamples.push({
          rowNumber: rowIndex + 2, // 1-indexed plus header row offset
          rowData: row,
          problems
        });
      }
    }
  });

  return {
    problemCount,
    problemSamples
  };
};

// Parser main function
const parseUploadedFile = (buffer, fileName, sheetName = null) => {
  const ext = fileName.split('.').pop().toLowerCase();
  let rawRows = [];
  let sheetNames = [];
  let activeSheet = null;

  if (ext === 'csv') {
    const csvString = buffer.toString('utf8');
    const parseResult = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: 'greedy'
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      // Find critical parsing failures
      const criticalError = parseResult.errors.find(e => e.code === 'TooManyFields' || e.code === 'UndetectableDelimiter');
      if (criticalError) {
        throw new Error(`CSV Parse Error: ${criticalError.message}`);
      }
    }
    rawRows = parseResult.data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new Error('Excel file has no worksheets');
    }
    // Use specified sheet if valid, otherwise fallback to the first sheet
    activeSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
    const worksheet = workbook.Sheets[activeSheet];
    rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  } else {
    throw new Error('Unsupported file extension. Only .csv, .xls, and .xlsx are supported.');
  }

  if (rawRows.length === 0) {
    throw new Error('The uploaded file contains no data rows');
  }

  // Get raw headers from first row
  const rawHeaders = Object.keys(rawRows[0]);
  if (rawHeaders.length === 0) {
    throw new Error('No column headers detected in the uploaded file');
  }

  if (rawHeaders.length > 200) {
    throw new Error('The dataset exceeds the maximum allowable column count of 200');
  }

  // Normalize headers
  const cleanHeaders = sanitizeHeaders(rawHeaders);

  // Map rows to normalized headers
  const parsedRows = rawRows.map(row => {
    const cleanRow = {};
    rawHeaders.forEach((rawCol, idx) => {
      const cleanCol = cleanHeaders[idx];
      if (cleanCol) {
        let val = row[rawCol];
        // Normalize strings/numbers slightly
        if (typeof val === 'string') {
          val = val.trim();
          if (val === '') val = null;
        }
        cleanRow[cleanCol] = val;
      }
    });
    return cleanRow;
  });
  // Infer Schema
  const schema = inferSchema(parsedRows, cleanHeaders);

  // Cast values based on inferred types
  const castedRows = parsedRows.map(row => {
    const castedRow = { ...row };
    schema.forEach(colSchema => {
      const val = row[colSchema.column];
      if (val === null || val === undefined || val === '') {
        castedRow[colSchema.column] = null;
        return;
      }
      if (colSchema.type === 'numeric') {
        const clean = val.toString().replace(/[\$,]/g, '').trim();
        const num = Number(clean);
        castedRow[colSchema.column] = isNaN(num) ? null : num;
      } else if (colSchema.type === 'date') {
        const time = Date.parse(val);
        castedRow[colSchema.column] = isNaN(time) ? null : new Date(time);
      } else if (colSchema.type === 'boolean') {
        const str = val.toString().trim().toLowerCase();
        castedRow[colSchema.column] = ['true', 'yes', '1', 'y'].includes(str);
      }
    });
    return castedRow;
  });

  const validation = validateRows(parsedRows, schema);

  return {
    headers: cleanHeaders,
    rows: castedRows,
    schema,
    rowCount: castedRows.length,
    sheetNames,
    activeSheet,
    validation
  };
};

module.exports = {
  parseUploadedFile,
  isNumericString,
  isDateString,
  isBooleanString
};
