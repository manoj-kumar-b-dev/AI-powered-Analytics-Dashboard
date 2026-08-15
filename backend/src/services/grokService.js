/**
 * Grok Service (Re-exported via Unified UniversalLlmService)
 */

const llmService = require('./llmService');

class GrokServiceAdapter {
  async generateInsights(context = {}) {
    return llmService.generateInsights(context);
  }

  _calculateDatasetStats(rows, kpis) {
    return llmService._calculateDatasetStats(rows, kpis);
  }

  _generateStatisticalFallback(stats, kpis, rows, anomalyList) {
    return llmService._generateStatisticalFallback(stats, kpis, rows, anomalyList);
  }

  _renderHtmlFromInsights(insights) {
    return llmService._renderHtmlFromInsights(insights);
  }
}

module.exports = new GrokServiceAdapter();
