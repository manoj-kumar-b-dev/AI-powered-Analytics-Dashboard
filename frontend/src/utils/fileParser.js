import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Reads the sheet names of an Excel workbook.
 * @param {File} file 
 * @returns {Promise<string[]>}
 */
export const readWorkbookSheets = (file) => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      resolve([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (err) {
        reject(new Error('Failed to read Excel workbook sheets: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('File reading error'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses CSV or Excel files client-side.
 * @param {File} file 
 * @param {string} [sheetName] 
 * @returns {Promise<{headers: string[], rows: object[], sheetNames: string[], activeSheet: string|null}>}
 */
export const parseFileClientSide = (file, sheetName = null) => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        Papa.parse(text, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            if (results.errors && results.errors.length > 0) {
              const critical = results.errors.find(err => err.code === 'TooManyFields' || err.code === 'UndetectableDelimiter');
              if (critical) {
                reject(new Error(`CSV Parse Error: ${critical.message}`));
                return;
              }
            }
            const rows = results.data;
            if (rows.length === 0) {
              reject(new Error('The uploaded file contains no data rows'));
              return;
            }
            const headers = Object.keys(rows[0]);
            resolve({
              headers,
              rows,
              sheetNames: [],
              activeSheet: null
            });
          },
          error: (err) => {
            reject(new Error(`CSV Parsing failed: ${err.message}`));
          }
        });
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          if (sheetNames.length === 0) {
            reject(new Error('Excel file has no worksheets'));
            return;
          }
          const activeSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
          const worksheet = workbook.Sheets[activeSheet];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          if (rows.length === 0) {
            reject(new Error('The selected sheet contains no data rows'));
            return;
          }
          const headers = Object.keys(rows[0]);
          resolve({
            headers,
            rows,
            sheetNames,
            activeSheet
          });
        } catch (err) {
          reject(new Error(`Excel Parsing failed: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Unsupported file extension. Only .csv, .xls, and .xlsx are supported.'));
    }
  });
};
