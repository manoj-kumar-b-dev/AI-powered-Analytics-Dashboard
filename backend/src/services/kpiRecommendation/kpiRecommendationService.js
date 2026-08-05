/**
 * KPI Recommendation Service — Semantic + Domain Aware
 *
 * Responsibilities:
 * - Generate domain-aware, semantically validated KPI column mappings.
 * - Every KPI candidate is validated by the Aggregation Compatibility Engine.
 * - Calls the RecommendationPipeline which handles AI enrichment.
 *
 * Returns KPI mappings in the format consumed by analyticsService.calculateKPIs():
 *   { kpi, column, label, format, icon, color, aggregation }
 *
 * Interface:
 * - recommendKPIs(schema: Array, domain?: string): Promise<Array>
 */

const { runRecommendationPipeline } = require('../../analytics/recommendations/recommendationPipeline');

// ---------------------------------------------------------------------------
// Format mapping from candidate format to display format
// ---------------------------------------------------------------------------
const FORMAT_ICONS = {
  currency: 'IndianRupee',
  percent: 'Percent',
  number: 'Activity'
};

const FORMAT_COLORS = {
  currency: 'purple',
  percent: 'emerald',
  number: 'blue'
};

// ---------------------------------------------------------------------------
// KPIRecommendationService
// ---------------------------------------------------------------------------

class KPIRecommendationService {
  /**
   * Recommend KPI column mappings from schema using the semantic pipeline.
   *
   * @param {Array} schema - Dataset column schema
   * @param {string} domain - Dataset domain (e.g., 'hr', 'sales')
   * @returns {Promise<Array>} Array of KPI mappings for analyticsService
   */
  async recommendKPIs(schema, domain = 'general') {
    if (!schema || schema.length === 0) return [];

    try {
      const { kpiCandidates } = await runRecommendationPipeline(domain, schema);

      if (!kpiCandidates || kpiCandidates.length === 0) {
        console.warn(`[KPIRecommendation] Pipeline returned no KPI candidates for domain "${domain}". Schema has ${schema.length} columns.`);
        return [];
      }

      // Map pipeline candidates to the format analyticsService.calculateKPIs() expects
      const mapped = kpiCandidates.map(candidate => ({
        kpi: candidate.id,
        column: candidate.column,
        label: candidate.title,
        format: candidate.format || 'number',
        icon: candidate.icon || FORMAT_ICONS[candidate.format] || 'Activity',
        color: candidate.color || FORMAT_COLORS[candidate.format] || 'blue',
        aggregation: candidate.aggregation,
        semanticRole: candidate.semanticRole,
        priority: candidate.priority || 'secondary',
        score: candidate.score,
        source: candidate.source
      }));

      console.log(`[KPIRecommendation] Returning ${mapped.length} KPI mappings for domain "${domain}"`);
      return mapped;

    } catch (err) {
      console.error('[KPIRecommendation] Pipeline error:', err.message);
      return [];
    }
  }
}

module.exports = new KPIRecommendationService();
