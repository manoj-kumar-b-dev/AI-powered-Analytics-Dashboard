const grokService = require('../services/grokService');

/**
 * Controller for AI Insights Generation powered by Grok API (xAI)
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
    const data = body.data || config.sampleRows || [];

    const context = {
      kpis: config.kpis || [],
      charts: config.charts || [],
      data: Array.isArray(data) ? data : []
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
      modelUsed: result.modelUsed || 'grok-beta',
      insights: result.insights || [],
      insightsHtml: result.insightsHtml || ''
    });
  } catch (error) {
    console.error('Error in insightController generateInsights:', error);
    next(error);
  }
};
