/**
 * Chart Recommendation Service — Semantic + Domain Aware
 *
 * Responsibilities:
 * - Generate domain-aware, semantically validated chart suggestions.
 * - Every chart passes through the Aggregation Compatibility Engine.
 * - No chart with SUM(Age), SUM(Rating), SUM(Attendance%), or AVG(ID) will be generated.
 *
 * Interface:
 * - recommendCharts(schema: Array, domain?: string): Promise<Array>
 *
 * Returns chart suggestions in the format consumed by analyticsService.generateCharts():
 *   { chartType, xField, yField, aggregation, confidence, reason }
 */

const { runRecommendationPipeline } = require('../../analytics/recommendations/recommendationPipeline');

// ---------------------------------------------------------------------------
// ChartRecommendationService
// ---------------------------------------------------------------------------

class ChartRecommendationService {
  /**
   * Recommend charts for a dataset using the semantic pipeline.
   *
   * @param {Array} schema - Dataset column schema
   * @param {string} domain - Dataset domain
   * @returns {Promise<Array>} Array of chart suggestions
   */
  async recommendCharts(schema, domain = 'general') {
    if (!schema || schema.length === 0) return [];

    try {
      const { chartCandidates } = await runRecommendationPipeline(domain, schema);

      if (!chartCandidates || chartCandidates.length === 0) {
        console.warn(`[ChartRecommendation] Pipeline returned no chart candidates for domain "${domain}"`);
        return [];
      }

      // Map pipeline candidates to the format analyticsService.generateCharts() expects
      const mapped = chartCandidates.map(candidate => ({
        chartType: candidate.chartType || 'bar',
        xField: candidate.xField,
        yField: candidate.yField || '_count',
        aggregation: candidate.aggregation,
        confidence: candidate.score || 70,
        reason: candidate.businessReason || '',
        title: candidate.title || '',
        priority: candidate.priority || 'secondary',
        xSemanticRole: candidate.xSemanticRole,
        ySemanticRole: candidate.ySemanticRole
      }));

      console.log(`[ChartRecommendation] Returning ${mapped.length} chart suggestions for domain "${domain}"`);
      return mapped;

    } catch (err) {
      console.error('[ChartRecommendation] Pipeline error:', err.message);
      return [];
    }
  }
}

module.exports = new ChartRecommendationService();
