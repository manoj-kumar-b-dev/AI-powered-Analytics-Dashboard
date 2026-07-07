const mongoose = require('mongoose');
const DataSource = require('../models/dataSource');
const DataRow = require('../models/dataRow');
const ChartRecommendationService = require('../services/chartRecommendation/chartRecommendationService');
const KPIRecommendationService = require('../services/kpiRecommendation/kpiRecommendationService');
const AnalyticsService = require('../services/analyticsService');

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

    const isDate = xCol.type === 'date';
    const isScatter = yCol && aggregation === 'none';

    let pipeline = [];
    pipeline.push({ $match: { dataSourceId: new mongoose.Types.ObjectId(id), orgId: new mongoose.Types.ObjectId(req.user.orgId) } });

    if (isScatter || aggregation === 'none') {
      pipeline.push({
        $project: {
          _id: 0,
          x: `$data.${xField}`,
          y: yCol ? `$data.${yField}` : null
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

    if (isDate) {
      pipeline.push({ $sort: { x: 1 } });
    } else {
      pipeline.push({ $sort: { y: -1 } });
    }

    let results = await DataRow.aggregate(pipeline);

    const maxPoints = 100;
    let downsampled = false;
    if (results.length > maxPoints) {
      downsampled = true;
      if (isDate) {
        const interval = Math.ceil(results.length / maxPoints);
        results = results.filter((_, index) => index % interval === 0).slice(0, maxPoints);
      } else {
        const topRows = results.slice(0, maxPoints - 1);
        const otherRows = results.slice(maxPoints - 1);
        const otherSum = otherRows.reduce((acc, row) => acc + (row.y || 0), 0);
        results = [...topRows, { x: 'Other', y: otherSum }];
      }
    }

    return res.status(200).json({
      data: results,
      downsampled,
      message: downsampled ? 'Data downsampled to 100 buckets for chart stability.' : undefined
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
    const mappedCols = {};
    dataSource.schema.forEach(c => { mappedCols[c.column] = c.column; });
    mappedColsList.forEach(m => { mappedCols[m.kpi] = m.column; });
    if (dataSource.kpiMapping) {
      Object.keys(dataSource.kpiMapping).forEach(k => {
        if (dataSource.kpiMapping[k]) mappedCols[k] = dataSource.kpiMapping[k];
      });
    }

    const cards = await AnalyticsService.calculateKPIs(dataSource, mappedCols, req.query);
    return res.status(200).json(cards);
  } catch (err) {
    console.error('Fetch KPIs Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to compute KPIs', stack: err.stack } });
  }
};
