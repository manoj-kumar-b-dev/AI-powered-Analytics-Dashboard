const { callLLMAPI } = require('./llmClient');

/**
 * Wraps the Gemini API call.
 *
 * @param {Object} params
 * @param {string} params.systemInstruction - System instructions for the model
 * @param {string} params.prompt - Input prompt
 * @param {Object} [params.responseSchema] - Optional response schema
 * @returns {Promise<string>} Raw text response from Gemini API
 */
const callGemini = async ({ systemInstruction, prompt, responseSchema }) => {
  const responseMimeType = responseSchema ? 'application/json' : undefined;
  return callLLMAPI({
    provider: 'gemini',
    systemInstruction,
    prompt,
    responseMimeType
  });
};

module.exports = {
  callGemini
};
