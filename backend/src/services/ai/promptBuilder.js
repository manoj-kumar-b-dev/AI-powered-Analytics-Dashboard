/**
 * Truncates values that exceed a specified character threshold.
 */
const truncateValue = (val, maxLength = 200) => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') {
    // If it's a date or nested object, serialize it
    const str = val instanceof Date ? val.toISOString() : JSON.stringify(val);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '... [TRUNCATED]';
    }
    return val;
  }
  const str = val.toString();
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '... [TRUNCATED]';
  }
  return val;
};

/**
 * Builds a structured, size-capped prompt for Gemini API calls.
 * Enforces a strict maximum of 5 sample rows and truncates long field values.
 *
 * @param {Object} params - The inputs to construct the prompt.
 * @param {string} params.task - The description of the task for the model.
 * @param {Object} params.metadata - The dataset metadata object (from Phase 2).
 * @param {Array<Object>} [params.sampleRows] - Optional sample rows from the dataset.
 * @param {*} [params.extraContext] - Optional additional context parameters.
 * @returns {string} The formatted prompt string.
 */
const buildPrompt = ({ task, metadata, sampleRows, extraContext }) => {
  // Deep clone and clean metadata to ensure no raw rows or samples are nested inside
  const safeMetadata = metadata ? { ...metadata } : {};
  delete safeMetadata.rows;
  delete safeMetadata.sampleRows;

  // Limit sample rows to at most 5
  const rawSamples = Array.isArray(sampleRows) ? sampleRows : [];
  const limitedSamples = rawSamples.slice(0, 5);

  // Sanitize and truncate sample rows
  const safeSamples = limitedSamples.map(row => {
    if (!row || typeof row !== 'object') return row;
    const cleanRow = {};
    for (const key of Object.keys(row)) {
      cleanRow[key] = truncateValue(row[key], 200);
    }
    return cleanRow;
  });

  // Construct prompt
  let promptText = `TASK:\n${task || 'Analyze the dataset.'}\n\n`;
  promptText += `DATASET METADATA:\n${JSON.stringify(safeMetadata, null, 2)}\n\n`;
  promptText += `SAMPLE ROWS (MAX 5, SENSITIVE DATA TRUNCATED):\n${JSON.stringify(safeSamples, null, 2)}\n\n`;

  if (extraContext) {
    const formattedContext = typeof extraContext === 'object'
      ? JSON.stringify(extraContext, null, 2)
      : extraContext;
    promptText += `ADDITIONAL CONTEXT:\n${formattedContext}\n\n`;
  }

  return promptText;
};

module.exports = {
  buildPrompt,
  truncateValue
};
