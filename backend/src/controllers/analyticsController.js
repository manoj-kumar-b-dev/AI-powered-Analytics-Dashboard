const mongoose = require('mongoose');
const DataSource = require('../models/dataSource');
const DataRow = require('../models/dataRow');
const ChartRecommendationService = require('../services/chartRecommendation/chartRecommendationService');
const KPIRecommendationService = require('../services/kpiRecommendation/kpiRecommendationService');
const AnalyticsService = require('../services/analyticsService');
const { buildTemporalPipeline } = require('../analytics/execution/temporalAggregationExecutor');

// -------------------------------------------------------
// GET /analytics/:id/suggest-charts
// Used by Upload tab to preview chart suggestions
// -------------------------------------------------------
exports.suggestCharts = async (req, res) => {
  try {
    const dataSource = await DataSource.findOne({
      _id: req.params.id,
      orgId: req.user.orgId
    }).lean();
    if (!dataSource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data source not found' } });
    }
    // Use domain if previously classified and stored, else default
    const domain = dataSource.domain || 'general';
    const suggestions = await ChartRecommendationService.recommendCharts(dataSource.schema, domain);
    return res.status(200).json(suggestions);
  } catch (err) {
    console.error('Suggest Charts Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to suggest charts' } });
  }
};

// -------------------------------------------------------
// GET /analytics/:id/chart-data
// Used by Analytics tab for ad-hoc chart data fetching
// -------------------------------------------------------
exports.chartData = async (req, res) => {
  try {
    const { id } = req.params;
    const { xField, yField, aggregation } = req.query;

    if (!xField) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'xField parameter is required' } });
    }

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    }).lean();
    if (!dataSource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data source not found' } });
    }

    const xCol = dataSource.schema.find(c => c.column === xField);
    const yCol = yField && yField !== '_count' ? dataSource.schema.find(c => c.column === yField) : null;

    if (!xCol) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `xField "${xField}" not found in dataset schema` } });
    }

    const isDate = Boolean(
      xCol && (
        xCol.type === 'date' ||
        xCol.semanticRole === 'temporal_dimension' ||
        xCol.isTemporal ||
        /date|time|day|month|year|timestamp|created_at|updated_at|period/i.test(xField)
      )
    );
    const isScatter = yCol && aggregation === 'none';

    const baseMatch = { dataSourceId: new mongoose.Types.ObjectId(id), orgId: new mongoose.Types.ObjectId(req.user.orgId) };
    let pipeline = [{ $match: baseMatch }];

    // ── Scatter / raw projection ──────────────────────────────────────────────
    if (isScatter || aggregation === 'none') {
      pipeline.push({
        $project: {
          _id: 0,
          x: `₹data.${xField}`,
          y: yCol ? `₹data.${yField}` : null
        }
      });
      pipeline.push({ $limit: 150 });

      const results = await DataRow.aggregate(pipeline);
      return res.status(200).json({
        data: results,
        downsampled: results.length >= 150,
        message: results.length >= 150 ? 'Data capped at 150 points for performance.' : undefined
      });
    }

    // ── Date / time-series: use granularity-aware temporal aggregation ─────────
    if (isDate) {
      try {
        // Determine the actual date range so we can pick the right granularity
        const bounds = await DataRow.aggregate([
          { $match: baseMatch },
          { $match: { [`data.${xField}`]: { $ne: null, $exists: true } } },
          {
            $project: {
              dateVal: {
                $convert: {
                  input: `$data.${xField}`,
                  to: 'date',
                  onError: null,
                  onNull: null
                }
              }
            }
          },
          { $match: { dateVal: { $ne: null } } },
          { $group: { _id: null, min: { $min: '$dateVal' }, max: { $max: '$dateVal' } } }
        ]);

        const minDate = bounds[0]?.min ? new Date(bounds[0].min) : null;
        const maxDate = bounds[0]?.max ? new Date(bounds[0].max) : null;
        const metricField = (yField && yField !== '_count') ? yField : null;

        const temporal = buildTemporalPipeline(xField, metricField, aggregation, minDate, maxDate);

        // Build full pipeline: base match → temporal stages (which include their own $match, $group, $project, $sort)
        const fullPipeline = [
          { $match: baseMatch },
          // Filter null dates before temporal grouping
          { $match: { [`data.${xField}`]: { $ne: null, $exists: true } } },
          // Exclude temporal pipeline's own $match stages since we already match above
          ...temporal.pipeline.filter(s => !s.$match)
        ];

        const results = await DataRow.aggregate(fullPipeline);
        return res.status(200).json({
          data: results,
          granularity: temporal.granularity,
          downsampled: false
        });
      } catch (temporalErr) {
        console.error('[chartData] Temporal pipeline error:', temporalErr.message, '— falling back to categorical grouping.');
        // Fall through to categorical grouping below
      }
    }

    // ── Categorical grouping (non-date x-axis) ────────────────────────────────
    let groupStage = { _id: `$data.${xField}` };

    if (aggregation === 'count') {
      groupStage.yVal = { $sum: 1 };
    } else if (aggregation === 'sum') {
      groupStage.yVal = { $sum: `$data.${yField}` };
    } else if (aggregation === 'avg') {
      groupStage.yVal = { $avg: `$data.${yField}` };
    } else {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid aggregation value' } });
    }

    pipeline.push({ $group: groupStage });
    pipeline.push({ $project: { _id: 0, x: '$_id', y: '$yVal' } });
    pipeline.push({ $sort: { y: -1 } });

    let results = await DataRow.aggregate(pipeline);

    // Cap categories to top-N + "Other" bucket (only for non-date categorical charts)
    const maxPoints = 100;
    let downsampled = false;
    if (results.length > maxPoints) {
      downsampled = true;
      if (!isDate) {
        const topRows = results.slice(0, maxPoints - 1);
        const otherRows = results.slice(maxPoints - 1);
        const otherSum = otherRows.reduce((acc, row) => acc + (row.y || 0), 0);
        results = [...topRows, { x: 'Other', y: otherSum }];
      } else {
        const step = Math.ceil(results.length / maxPoints);
        results = results.filter((_, idx) => idx % step === 0).slice(0, maxPoints);
      }
    }

    return res.status(200).json({
      data: results,
      downsampled,
      message: downsampled ? 'Data downsampled to top 100 points.' : undefined
    });
  } catch (err) {
    console.error('Chart Data Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process chart data' } });
  }
};

// -------------------------------------------------------
// POST /analytics/:id/kpi-mapping
// Used by Upload tab to save manual KPI column overrides
// -------------------------------------------------------
exports.updateKpiMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const { mappings } = req.body;

    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'mappings object is required' } });
    }

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    }).lean();
    if (!dataSource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data source not found' } });
    }

    const cols = dataSource.schema.map(c => c.column);
    for (const [kpiKey, colVal] of Object.entries(mappings)) {
      if (colVal && !cols.includes(colVal)) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: `Column "${colVal}" not found in schema. Cannot map KPI "${kpiKey}".`
          }
        });
      }
    }

    const updatedMapping = { ...dataSource.kpiMapping, ...mappings };
    await DataSource.updateOne({ _id: id, orgId: req.user.orgId }, { $set: { kpiMapping: updatedMapping } });

    // Regenerate dashboard cache immediately so changes are reflected in the UI
    await AnalyticsService.persistAnalytics(id, req.user.orgId);

    return res.status(200).json({
      message: 'KPI overrides updated successfully',
      kpiMapping: updatedMapping
    });
  } catch (err) {
    console.error('Update KPI Mapping Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save overrides' } });
  }
};

// -------------------------------------------------------
// GET /analytics/:id/kpis
// Used by Upload tab to preview KPI values
// -------------------------------------------------------
exports.getKpis = async (req, res) => {
  try {
    const { id } = req.params;

    const dataSource = await DataSource.findOne({
      _id: id,
      orgId: req.user.orgId
    }).lean();
    if (!dataSource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data source not found' } });
    }

    const domain = dataSource.domain || 'general';
    const mappedColsList = await KPIRecommendationService.recommendKPIs(dataSource.schema, domain);
    const activeKPIs = AnalyticsService.getActiveKPIList(dataSource, mappedColsList);

    const cards = await AnalyticsService.calculateKPIs(dataSource, activeKPIs, req.query);
    return res.status(200).json(cards);
  } catch (err) {
    console.error('Fetch KPIs Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to compute KPIs', stack: err.stack } });
  }
};
