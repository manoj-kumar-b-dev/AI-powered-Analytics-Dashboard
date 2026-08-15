/**
 * Chart Explanation Service — LLM Powered
 * Delegated to UniversalLlmService
 */

const llmService = require('../llmService');

class ChartExplanationService {
  async explainChart(payload) {
    return llmService.explainChart(payload);
  }
}

module.exports = new ChartExplanationService();
