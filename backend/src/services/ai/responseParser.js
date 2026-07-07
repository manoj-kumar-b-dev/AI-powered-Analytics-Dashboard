/**
 * Strips markdown code blocks (e.g. ```json ... ```) from a string.
 */
const cleanMarkdownJSON = (text) => {
  if (typeof text !== 'string') return '';
  let clean = text.trim();

  // Strip leading/trailing code fences
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  return clean;
};

/**
 * Safely parses raw Gemini response text into a JSON object.
 *
 * @param {string} text - The raw text response from the AI model.
 * @returns {Object} Parse result: { success: true, data } or { success: false, error, message, rawResponse }
 */
const parseJSONResponse = (text) => {
  if (!text) {
    return {
      success: false,
      error: 'EMPTY_RESPONSE',
      message: 'The AI model returned an empty response.',
      rawResponse: text
    };
  }

  try {
    const cleaned = cleanMarkdownJSON(text);
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed };
  } catch (error) {
    // Robust fallback: attempt to extract JSON by locating the first '{' and last '}'
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonCandidate);
        return { success: true, data: parsed };
      }
    } catch (innerError) {
      // Suppress nested parsing error and return the primary catch information
    }

    return {
      success: false,
      error: 'JSON_PARSE_FAILURE',
      message: error.message,
      rawResponse: text
    };
  }
};

module.exports = {
  parseJSONResponse,
  cleanMarkdownJSON
};
