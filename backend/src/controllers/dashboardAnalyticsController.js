const DataSource = require('../models/dataSource');
const Analytics = require('../models/analytics');
const AnalyticsService = require('../services/analyticsService');

// How many hours before cached dashboard analytics are considered stale and regenerated via Groq.
// Override via ANALYTICS_CACHE_TTL_HOURS in .env (set to 0 to always regenerate).
const CACHE_TTL_HOURS = parseFloat(process.env.ANALYTICS_CACHE_TTL_HOURS ?? '6');
const CACHE_TTL_MS    = CACHE_TTL_HOURS * 60 * 60 * 1000;

const getActiveDataSource = async (orgId) => {
  let activeDS = await DataSource.findOne({ orgId, isActive: true });
  if (!activeDS) {
    activeDS = await DataSource.findOne({ orgId, status: 'confirmed' }).sort({ createdAt: -1 });
    if (activeDS) {
      activeDS.isActive = true;
      await activeDS.save();
    }
  }
  return activeDS;
};

exports.getUnifiedDashboard = async (req, res) => {
  try {
    const dataSource = await getActiveDataSource(req.user.orgId);
    if (!dataSource) {
      return res.status(200).json({
        kpis: [],
        charts: [],
        insights: [],
        filters: {},
        reports: {},
        recommendations: [],
        message: 'No active dataset found. Please upload a spreadsheet to begin.'
      });
    }

    const { date, department, region, product, category, salesperson } = req.query;
    const hasFilters = [date, department, region, product, category, salesperson].some(f => f !== undefined && f !== '');

    if (hasFilters) {
      const filteredData = await AnalyticsService.generateDashboard(dataSource.toObject(), {
        date,
        department,
        region,
        product,
        category,
        salesperson
      });
      return res.status(200).json({
        dataSourceId: dataSource._id,
        fileName: dataSource.fileName,
        ...filteredData
      });
    }

    // ── Cache staleness check ──────────────────────────────────────────────────
    // Re-run Groq if: no cached record exists, OR the cache is older than TTL,
    // OR the caller requests a forced refresh via ?refresh=1.
    const forceRefresh = req.query.refresh === '1';
    let analytics = await Analytics.findOne({ dataSourceId: dataSource._id, orgId: req.user.orgId });

    const cacheAge   = analytics ? Date.now() - new Date(analytics.updatedAt).getTime() : Infinity;
    const isStale    = CACHE_TTL_MS === 0 || cacheAge > CACHE_TTL_MS;

    if (!analytics || isStale || forceRefresh) {
      console.log(`[Dashboard] ${!analytics ? 'No cache found' : forceRefresh ? 'Force refresh' : `Cache stale (${Math.round(cacheAge / 60000)}m old, TTL=${CACHE_TTL_HOURS}h)`} — regenerating via Groq…`);
      analytics = await AnalyticsService.persistAnalytics(dataSource._id, req.user.orgId);
    } else {
      console.log(`[Dashboard] Serving cached analytics (age: ${Math.round(cacheAge / 60000)}m, TTL: ${CACHE_TTL_HOURS}h)`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json({
      dataSourceId: dataSource._id,
      fileName: dataSource.fileName,
      kpis: analytics.kpis,
      charts: analytics.charts,
      insights: analytics.insights,
      filters: analytics.filters,
      reports: analytics.reports,
      recommendations: analytics.recommendations
    });
  } catch (err) {
    console.error('Fetch Dashboard Analytics Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process dashboard metrics',
        stack: err.stack
      }
    });
  }
};

