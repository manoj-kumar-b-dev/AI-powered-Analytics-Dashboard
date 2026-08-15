/**
 * Gemini AI Client (Re-exported via Unified UniversalLlmService)
 */

const llmService = require('../services/llmService');

module.exports = {
  geminiGenerate: (prompt, options) => llmService.generate(prompt, options),
  isGeminiAvailable: () => llmService.isAvailable()
};
