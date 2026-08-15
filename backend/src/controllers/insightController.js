const grokService = require('../services/grokService');
const DataRow = require('../models/dataRow');

/**
 * Controller for AI Insights Generation powered by Universal LLM Service
 */
exports.generateInsights = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Check if configuration or data is present
    if (!body.config && !body.data) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Dashboard configuration is required to generate insights.' }
      });
    }

    const config = body.config || {};
    let data = body.data || config.sampleRows || [];

    // Fallback: If no sample data rows provided, query DataRow collection for dataset rows
    if ((!Array.isArray(data) || data.length === 0) && (config.dataSourceId || config._id)) {
      try {
        const dsId = config.dataSourceId || config._id;
        const rows = await DataRow.find({ dataSourceId: dsId }).limit(100).lean();
        data = rows.map(r => r.data);
      } catch (err) {
        console.warn('[InsightController] Could not fetch sample DataRows:', err.message);
      }
    }

    const context = {
      kpis: config.kpis || [],
      charts: config.charts || [],
      data: Array.isArray(data) ? data : [],
      domain: config.domain,
      domainLabel: config.domainLabel
    };

    const result = (await grokService.generateInsights(context)) || {};

    console.log('[InsightController] Generated Insights Result:\n', JSON.stringify(result, null, 2));

    // Support both structured result object and string HTML
    if (typeof result === 'string') {
      return res.status(200).json({
        success: true,
        insightsHtml: result,
        source: 'grok'
      });
    }

    return res.status(200).json({
      success: true,
      source: result.source || 'smart_analytics',
      modelUsed: result.modelUsed || 'statistical_engine_v2',
      insights: result.insights || [],
      insightsHtml: result.insightsHtml || ''
    });
  } catch (error) {
    console.error('Error in insightController generateInsights:', error);
    next(error);
  }
};
