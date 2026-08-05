const Papa = require('papaparse');
const XLSX = require('xlsx');

/**
 * Service for parsing uploaded CSV/Excel files and inferring column data types.
 */
class DatasetParserService {
  /**
   * Parse a file buffer based on filename extension.
   * @param {Buffer} buffer - File buffer
   * @param {string} fileName - Original file name
   * @returns {Promise<{ columns: Array<{name: string, type: string}>, rows: Array<Object>, rowCount: number }>}
   */
  async parseFile(buffer, fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    let rawRows = [];

    if (ext === 'csv') {
      const csvString = buffer.toString('utf8');
      const parseResult = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      rawRows = parseResult.data || [];
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Excel workbook has no sheets');
      }
      const sheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    } else {
      throw new Error(`Unsupported file type: .${ext}. Only .csv, .xlsx, and .xls are supported.`);
    }

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw new Error('Dataset file is empty or could not be parsed into rows.');
    }

    // Sanitize headers and clean rows
    const headers = Object.keys(rawRows[0]).map(h => (h || '').trim()).filter(Boolean);
    if (headers.length === 0) {
      throw new Error('No valid column headers found in dataset.');
    }

    const cleanedRows = rawRows.map(row => {
      const cleanObj = {};
      headers.forEach(h => {
        let val = row[h];
        if (val === undefined || val === null || val === '') {
          cleanObj[h] = null;
        } else if (typeof val === 'string') {
          cleanObj[h] = val.trim();
        } else {
          cleanObj[h] = val;
        }
      });
      return cleanObj;
    });

    // Infer column types
    const columns = headers.map(h => {
      const type = this._inferColumnType(cleanedRows, h);
      return { name: h, type };
    });

    return {
      columns,
      rows: cleanedRows,
      rowCount: cleanedRows.length
    };
  }

  /**
   * Infer column data type: 'string' | 'number' | 'date' | 'boolean'
   */
  _inferColumnType(rows, colName) {
    const nonNullValues = rows
      .map(r => r[colName])
      .filter(v => v !== null && v !== undefined && v !== '');

    if (nonNullValues.length === 0) return 'string';

    // 1. Check if all values are boolean
    const isBoolean = nonNullValues.every(v => {
      if (typeof v === 'boolean') return true;
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        return lower === 'true' || lower === 'false' || lower === 'yes' || lower === 'no';
      }
      return false;
    });
    if (isBoolean) return 'boolean';

    // 2. Check if all values are numbers
    const isNumber = nonNullValues.every(v => {
      if (typeof v === 'number') return !isNaN(v);
      if (typeof v === 'string') {
        // Strip commas and currency symbols if numeric string
        const cleaned = v.replace(/[\$,]/g, '').trim();
        return cleaned !== '' && !isNaN(Number(cleaned));
      }
      return false;
    });
    if (isNumber) return 'number';

    // 3. Check if all values are dates
    const isDate = nonNullValues.every(v => {
      if (v instanceof Date) return !isNaN(v.getTime());
      if (typeof v === 'string' && v.length >= 6) {
        // Reject plain numbers passed as string
        if (!isNaN(Number(v))) return false;
        const parsed = Date.parse(v);
        return !isNaN(parsed);
      }
      return false;
    });
    if (isDate) return 'date';

    // 4. Default to string
    return 'string';
  }
}

module.exports = new DatasetParserService();
