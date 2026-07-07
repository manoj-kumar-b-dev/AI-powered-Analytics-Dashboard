const { callLLMAPI } = require('./llmClient');
const { parseJSONResponse } = require('./responseParser');
const { validateSchema } = require('./schemaValidator');
const { GEMINI_MAX_RETRIES } = require('../../config/aiConfig');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a Gemini, OpenAI, or Anthropic request, parses the output, and validates it against a schema.
 * Re-runs the operation with exponential backoff on network/rate-limit errors,
 * or immediately with stricter formatting prompts on parsing/validation failures.
 *
 * @param {Object} params - Execution options.
 * @param {string} params.prompt - The input prompt.
 * @param {string} [params.systemInstruction] - Optional system guidelines.
 * @param {Object} [params.schema] - The Zod schema for format validation.
 * @param {string} [params.responseMimeType] - Output content type (defaults to 'application/json').
 * @returns {Promise<Object>} Result object: { success: true, data } or { success: false, error, details }
 */
const executeWithRetry = async (params) => {
  const { prompt, systemInstruction, schema, responseMimeType = 'application/json', ...rest } = params;
  let currentPrompt = prompt;
  let attempt = 0;
  const maxAttempts = 1 + GEMINI_MAX_RETRIES; // Original attempt + configurated retries (default 2)
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // 1. Call raw client API via unified dispatcher
      const rawText = await callLLMAPI({
        ...rest,
        systemInstruction,
        prompt: currentPrompt,
        responseMimeType
      });

      // ── Forward raw LLM response to backend log ──────────────────────────
      // (Groq-specific boxed output is already printed inside llmClient.js.
      //  This line gives a quick single-line reference per attempt.)
      console.log(`[retryHandler] Attempt ${attempt} → raw response length: ${rawText?.length ?? 0} chars`);

      // 2. Parse JSON response
      const parseResult = parseJSONResponse(rawText);
      if (!parseResult.success) {
        const parseErr = new Error(parseResult.message || 'JSON Parsing Error');
        parseErr.type = 'PARSE_FAILURE';
        parseErr.rawResponse = rawText;
        throw parseErr;
      }

      // 3. Validate Zod Schema
      const valResult = validateSchema(parseResult.data, schema);
      if (!valResult.success) {
        const valErr = new Error('JSON schema validation failed');
        valErr.type = 'VALIDATION_FAILURE';
        valErr.details = valResult.details;
        valErr.parsedData = parseResult.data;
        throw valErr;
      }

      // Success
      return {
        success: true,
        data: valResult.data,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      console.warn(`[AI retryHandler] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        // Differentiate rate-limit/network vs JSON structure issues
        const isTransientNetworkOrRateError =
          error.status === 429 ||
          (error.status >= 500 && error.status < 600) ||
          error.name === 'AbortError' ||
          error.message?.includes('fetch failed') ||
          error.message?.includes('Failed to fetch');

        if (isTransientNetworkOrRateError) {
          // Exponential backoff
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 150;
          console.warn(`[AI retryHandler] Transient issue. Retrying in ${Math.round(backoffMs)}ms...`);
          await wait(backoffMs);
        } else {
          // Schema/Parsing error - append direct schema warnings to enforce compliance
          console.warn(`[AI retryHandler] Format error. Appending strict instruction and retrying immediately...`);
          currentPrompt = `${prompt}\n\nCRITICAL: Your previous response was invalid. You MUST return ONLY valid JSON conforming exactly to the requested schema. Do not include markdown code fences, conversational comments, or explanations in your output.`;
        }
      }
    }
  }

  // All retries exhausted
  console.error(`[AI retryHandler] All ${maxAttempts} attempts failed. Logging error and returning typed result.`);
  return {
    success: false,
    error: 'AI_INTEGRATION_FAILURE',
    details: {
      message: lastError.message,
      type: lastError.type,
      details: lastError.details,
      rawResponse: lastError.rawResponse,
      status: lastError.status
    }
  };
};

module.exports = {
  executeWithRetry
};
