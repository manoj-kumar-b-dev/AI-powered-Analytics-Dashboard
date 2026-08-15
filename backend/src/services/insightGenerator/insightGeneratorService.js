/**
 * Insight Generator Service — LLM Powered
 * Delegated to UniversalLlmService
 */

const llmService = require('../llmService');

class InsightGeneratorService {
  /**
   * Generates business insights using UniversalLlmService.
   */
  async generateInsights(kpiSummary, anomalyList = [], domain = 'general', domainLabel = 'General') {
    const res = await llmService.generateInsights(kpiSummary, anomalyList, domain, domainLabel);
    if (Array.isArray(res)) return res;
    return res?.insights || [];
  }

  /**
   * Generates full structured insights object for 10 domain types.
   */
  async generateFullInsights(context = {}) {
    return llmService.generateFullInsights(context);
  }
}

module.exports = new InsightGeneratorService();
