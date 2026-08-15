const mongoose = require('mongoose');
const DataSource = require('../models/dataSource');
const DataRow = require('../models/dataRow');
const Analytics = require('../models/analytics');

// Import new microservices
const DatasetClassifierService = require('./datasetClassifier/datasetClassifierService');
const RuleEngineService = require('./ruleEngine/ruleEngineService');
const KPIRecommendationService = require('./kpiRecommendation/kpiRecommendationService');
const ChartRecommendationService = require('./chartRecommendation/chartRecommendationService');
const AnalyticsEngine = require('./analytics/analyticsEngine');
const InsightGeneratorService = require('./insightGenerator/insightGeneratorService');

// Universal pipeline validation + temporal execution
const { buildTemporalPipeline } = require('../analytics/execution/temporalAggregationExecutor');
const { validateChartResult, validateKPIResult } = require('../analytics/validation/resultValidator');

// Helper: Format Numbers (USD Default, K/M/B Abbreviated)
const formatValue = (num, type) => {
  if (num === null || num === undefined || isNaN(num)) return '—';

  const abs = Math.abs(num);
  let suffix = '';
  let val = num;

  if (abs >= 1.0e9) {
    val = num / 1.0e9;
    suffix = 'B';
  } else if (abs >= 1.0e6) {
    val = num / 1.0e6;
    suffix = 'M';
  } else if (abs >= 1.0e3) {
    val = num / 1.0e3;
    suffix = 'K';
  }

  const isCurrency = type === 'currency';
  const formattedVal = val.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });

  return isCurrency ? `₹${formattedVal}${suffix}` : `${formattedVal}${suffix}`;
};

// Build MongoDB Match Stage based on schema mapping and filters
const buildMatchStage = async (dataSource, mappedCols, filters) => {
  const match = {
    dataSourceId: dataSource._id,
    orgId: dataSource.orgId
  };

  if (!filters) return match;

  const schemaCols = dataSource.schema.map(c => c.column);
  const dateCol = mappedCols.date;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    if (key === 'date') {
      if (dateCol) {
        const bounds = await DataRow.aggregate([
          { $match: { dataSourceId: dataSource._id, orgId: dataSource.orgId } },
          { $group: { _id: null, max: { $max: `$data.${dateCol}` } } }
        ]);

        if (bounds.length > 0 && bounds[0].max) {
          const maxDate = new Date(bounds[0].max);
          let minFilterDate = null;

          if (value === 'today') {
            minFilterDate = new Date(maxDate.getTime() - 24 * 60 * 60 * 1000);
          } else if (value === '7days') {
            minFilterDate = new Date(maxDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          } else if (value === '30days') {
            minFilterDate = new Date(maxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          }

          if (minFilterDate) {
            match[`data.${dateCol}`] = { $gte: minFilterDate };
          }
        }
      }
    } else {
      const matchedCol = schemaCols.find(c => c.toLowerCase() === key.toLowerCase());
      if (matchedCol) {
        match[`data.${matchedCol}`] = value;
      }
    }
  }

  return match;
};

class AnalyticsService {
  static generateChartTitle(xField, yField, aggregation) {
    const agg = (aggregation || '').toLowerCase();
    if (agg === 'none' || !agg) {
      return `Distribution of ${yField} by ${xField}`;
    }
    if (yField === '_count' || agg === 'count') {
      return `Count of Records by ${xField}`;
    }
    return `${agg.toUpperCase()} of ${yField} by ${xField}`;
  }

  static computeComparison({ currentVal, priorVal, currentCount, priorCount, hasDateCol, hasPeriodBounds }) {
    let deltaPct = null;
    let deltaDirection = 'flat';
    let period = null;

    if (hasDateCol && hasPeriodBounds) {
      if (currentCount === 0) {
        period = 'No data for this period';
      } else if (priorCount === 0) {
        period = 'No prior period data for comparison';
      } else if (priorVal === 0) {
        deltaPct = currentVal > 0 ? 100 : 0;
        deltaDirection = currentVal > 0 ? 'up' : 'flat';
        period = 'vs prior period';
      } else {
        const diff = currentVal - priorVal;
        deltaPct = Math.round((diff / Math.abs(priorVal)) * 1000) / 10;
        deltaDirection = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        period = 'vs prior period';
      }
    }

    return { deltaPct, deltaDirection, period };
  }

  /**
   * Helper to consistently calculate boundary dates for current and prior periods.
   * Derives boundaries relative to maxDate from the dataset, not the system clock.
   * Period lengths for current and prior are strictly identical.
   */
  static calculatePeriodBounds(minDate, maxDate, dateFilterValue) {
    if (!maxDate || !minDate) return null;

    let currentStart, currentEnd, priorStart, priorEnd;
    currentEnd = new Date(maxDate.getTime());

    if (dateFilterValue === 'today') {
      currentStart = new Date(maxDate.getTime() - 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime());
      priorStart = new Date(priorEnd.getTime() - 24 * 60 * 60 * 1000);
    } else if (dateFilterValue === '7days') {
      currentStart = new Date(maxDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime());
      priorStart = new Date(priorEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilterValue === '30days') {
      currentStart = new Date(maxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime());
      priorStart = new Date(priorEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      // "All Time": Split the dataset duration in half
      const duration = maxDate.getTime() - minDate.getTime();
      currentStart = new Date(minDate.getTime() + duration / 2);
      priorEnd = new Date(currentStart.getTime());
      priorStart = new Date(minDate.getTime());
    }

    return { currentStart, currentEnd, priorStart, priorEnd };
  }

  static getActiveKPIList(dataSource, mappedColsList) {
    const activeKPIs = [...mappedColsList];
    if (dataSource.kpiMapping) {
      Object.entries(dataSource.kpiMapping).forEach(([kpiKey, colName]) => {
        if (!colName) return;
        const existing = activeKPIs.find(m => m.kpi === kpiKey);
        if (existing) {
          existing.column = colName;
        } else {
          // Standard metadata guesses for manual overrides if not in recommended list
          const label = kpiKey.charAt(0).toUpperCase() + kpiKey.slice(1).replace(/_/g, ' ');
          const isCurrency = ['revenue', 'expenses', 'profit'].includes(kpiKey.toLowerCase());
          activeKPIs.push({
            kpi: kpiKey,
            column: colName,
            label,
            format: isCurrency ? 'currency' : 'number',
            icon: (kpiKey.toLowerCase() === 'revenue' || isCurrency) ? 'IndianRupee' : kpiKey.toLowerCase() === 'sales' ? 'ShoppingCart' : 'Activity',
            color: 'blue'
          });
        }
      });
    }
    return activeKPIs;
  }

  static getKpiAggregation(kpiKey, colName, colType, explicitAggregation) {
    // If the semantic pipeline already determined the aggregation, use it directly
    if (explicitAggregation) {
      const aggNorm = explicitAggregation.toLowerCase().trim();
      // Map 'count_distinct' / 'distinct' to 'distinct' for internal use
      if (aggNorm === 'count_distinct' || aggNorm === 'distinct') return 'distinct';
      if (aggNorm === 'avg' || aggNorm === 'sum' || aggNorm === 'count' || aggNorm === 'min' || aggNorm === 'max') return aggNorm;
    }

    // Fallback heuristic (used only when aggregation is not explicitly set by pipeline)
    const kpiLower = kpiKey.toLowerCase();
    const colLower = colName.toLowerCase();

    if (colType === 'numeric' || colType === 'currency' || colType === 'percentage') {
      if (
        kpiLower.includes('salary') ||
        kpiLower.includes('rating') ||
        kpiLower.includes('attendance') ||
        kpiLower.includes('margin') ||
        kpiLower.includes('ratio') ||
        kpiLower.includes('pct') ||
        kpiLower.includes('percent') ||
        kpiLower.includes('avg') ||
        kpiLower.includes('average') ||
        kpiLower.includes('score') ||
        kpiLower.includes('age') ||
        colLower.includes('salary') ||
        colLower.includes('rating') ||
        colLower.includes('attendance') ||
        colLower.includes('margin') ||
        colLower.includes('ratio') ||
        colLower.includes('pct') ||
        colLower.includes('percent') ||
        colLower.includes('avg') ||
        colLower.includes('average') ||
        colLower.includes('score') ||
        colLower.includes('age')
      ) {
        return 'avg';
      }
      return 'sum';
    }

    if (colLower.endsWith('id') || colLower.includes('id_') || colLower.includes('_id') || kpiLower.includes('customer') || kpiLower.includes('employee') || kpiLower.includes('headcount')) {
      return 'distinct';
    }
    return 'count';
  }

  static async calculateKPIs(dataSource, mappedColsList, filters) {
    const dateKpi = mappedColsList.find(m => m.kpi === 'date');
    const dateCol = dateKpi ? dateKpi.column : dataSource.schema.find(c => c.type === 'date')?.column;

    const mappedCols = { date: dateCol };
    mappedColsList.forEach(m => {
      mappedCols[m.kpi] = m.column;
    });

    // Remove date constraint to ensure we query data for the prior period as well
    const filtersNoDate = { ...filters };
    delete filtersNoDate.date;
    const baseMatchNoDate = await buildMatchStage(dataSource, mappedCols, filtersNoDate);

    let minDate = null;
    let maxDate = null;
    let periodBounds = null;

    if (dateCol) {
      const bounds = await DataRow.aggregate([
        { $match: baseMatchNoDate },
        {
          $group: {
            _id: null,
            min: { $min: `$data.${dateCol}` },
            max: { $max: `$data.${dateCol}` }
          }
        }
      ]);
      if (bounds.length > 0 && bounds[0].min && bounds[0].max) {
        minDate = new Date(bounds[0].min);
        maxDate = new Date(bounds[0].max);
        if (minDate.getTime() !== maxDate.getTime()) {
          periodBounds = this.calculatePeriodBounds(minDate, maxDate, filters?.date);
        }
      }
    }

    const cards = [];

    // Filter out date KPI since it is not displayed as a card
    const numericKpis = mappedColsList.filter(m => m.kpi !== 'date');

    const regularKpis = [];
    const distinctKpis = [];

    numericKpis.forEach(m => {
      const colSchema = dataSource.schema.find(c => c.column === m.column);
      const colType = colSchema ? colSchema.type : 'numeric';
      // Pass explicit aggregation from semantic pipeline if available
      const agg = this.getKpiAggregation(m.kpi, m.column, colType, m.aggregation);

      if (agg === 'distinct') {
        distinctKpis.push({ kpi: m, agg });
      } else {
        regularKpis.push({ kpi: m, agg });
      }
    });

    // 1. Regular aggregate calculations via a single $group query
    const groupStage = { _id: null };

    regularKpis.forEach(({ kpi, agg }) => {
      const col = kpi.column;
      const kpiName = kpi.kpi;

      if (periodBounds) {
        const { currentStart, priorStart, priorEnd } = periodBounds;

        if (agg === 'sum') {
          groupStage[`total_${kpiName}`] = { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${col}`, 0] } };
          groupStage[`prior_${kpiName}`] = { $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${col}`, 0] } };
          groupStage[`current_${kpiName}`] = { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${col}`, 0] } };
        } else if (agg === 'avg') {
          groupStage[`total_${kpiName}`] = { $avg: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${col}`, null] } };
          groupStage[`prior_${kpiName}`] = { $avg: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${col}`, null] } };
          groupStage[`current_${kpiName}`] = { $avg: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${col}`, null] } };
        } else if (agg === 'count') {
          groupStage[`total_${kpiName}`] = { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, 1, 0] } };
          groupStage[`prior_${kpiName}`] = { $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, 1, 0] } };
          groupStage[`current_${kpiName}`] = { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, 1, 0] } };
        }

        groupStage[`currentCount_${kpiName}`] = { $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, currentStart] }, { $ne: [`$data.${col}`, null] }] }, 1, 0] } };
        groupStage[`priorCount_${kpiName}`] = { $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }, { $ne: [`$data.${col}`, null] }] }, 1, 0] } };

      } else {
        if (agg === 'sum') {
          groupStage[`total_${kpiName}`] = { $sum: `$data.${col}` };
        } else if (agg === 'avg') {
          groupStage[`total_${kpiName}`] = { $avg: `$data.${col}` };
        } else if (agg === 'count') {
          groupStage[`total_${kpiName}`] = { $sum: 1 };
        }
      }
    });

    let totals = {};
    if (Object.keys(groupStage).length > 1) {
      const totalsResult = await DataRow.aggregate([
        { $match: baseMatchNoDate },
        { $group: groupStage }
      ]);
      totals = totalsResult[0] || {};
    }

    const buildCard = (kpiName, label, val, format, priorVal, currentVal, currentCount, priorCount) => {
      const isCurrency = format === 'currency';
      const isPercentage = format === 'percent';

      const { deltaPct, deltaDirection, period } = this.computeComparison({
        currentVal,
        priorVal,
        currentCount,
        priorCount,
        hasDateCol: !!dateCol,
        hasPeriodBounds: !!periodBounds
      });

      let formattedValue = val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      if (isCurrency) {
        formattedValue = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      } else if (isPercentage) {
        formattedValue = `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
      }

      return {
        kpi: kpiName,
        label,
        value: val,
        formattedValue,
        deltaPct,
        deltaDirection,
        period
      };
    };

    // 2. Process regular KPIs and push to cards
    regularKpis.forEach(({ kpi }) => {
      const kpiName = kpi.kpi;
      const totalVal = totals[`total_${kpiName}`] || 0;
      const priorVal = totals[`prior_${kpiName}`] || 0;
      const currentVal = totals[`current_${kpiName}`] || 0;
      const currentCount = totals[`currentCount_${kpiName}`] || 0;
      const priorCount = totals[`priorCount_${kpiName}`] || 0;

      const card = buildCard(kpiName, kpi.label, totalVal, kpi.format, priorVal, currentVal, currentCount, priorCount);
      card.icon = kpi.icon || null;
      card.color = kpi.color || null;
      cards.push(card);
    });

    // 3. Process distinct KPIs and push to cards
    for (const { kpi } of distinctKpis) {
      const kpiName = kpi.kpi;
      const col = kpi.column;

      const totalResult = await DataRow.aggregate([
        { $match: baseMatchNoDate },
        { $group: { _id: `$data.${col}` } },
        { $count: "total" }
      ]);
      const totalVal = totalResult[0]?.total || 0;

      let priorVal = 0;
      let currentVal = 0;
      let currentCount = 0;
      let priorCount = 0;

      if (dateCol && periodBounds) {
        const { currentStart, priorStart, priorEnd } = periodBounds;

        const priorResult = await DataRow.aggregate([
          { $match: { ...baseMatchNoDate, [`data.${dateCol}`]: { $gte: priorStart, $lt: priorEnd } } },
          { $group: { _id: `$data.${col}` } },
          { $count: "total" }
        ]);
        priorVal = priorResult[0]?.total || 0;
        priorCount = priorVal;

        const currentResult = await DataRow.aggregate([
          { $match: { ...baseMatchNoDate, [`data.${dateCol}`]: { $gte: currentStart } } },
          { $group: { _id: `$data.${col}` } },
          { $count: "total" }
        ]);
        currentVal = currentResult[0]?.total || 0;
        currentCount = currentVal;
      }

      const card = buildCard(kpiName, kpi.label, totalVal, kpi.format, priorVal, currentVal, currentCount, priorCount);
      card.icon = kpi.icon || null;
      card.color = kpi.color || null;
      cards.push(card);
    }

    // 4. Period growth rate calculation (optional standard card if date column exists)
    if (dateCol && periodBounds) {
      const revenueKpi = numericKpis.find(m => m.kpi === 'revenue');
      const salesKpi = numericKpis.find(m => m.kpi === 'sales');
      const targetKpi = revenueKpi || salesKpi || numericKpis[0];

      if (targetKpi) {
        const kpiName = targetKpi.kpi;
        const pVal = totals[`prior_${kpiName}`] || 0;
        const cVal = totals[`current_${kpiName}`] || 0;
        const pCount = totals[`priorCount_${kpiName}`] || 0;
        const cCount = totals[`currentCount_${kpiName}`] || 0;

        const comp = this.computeComparison({
          currentVal: cVal,
          priorVal: pVal,
          currentCount: cCount,
          priorCount: pCount,
          hasDateCol: true,
          hasPeriodBounds: true
        });

        const growthValue = comp.deltaPct !== null ? comp.deltaPct : 0.0;
        const growthFormatted = comp.period === 'No data for this period' ? '—' : `${growthValue.toFixed(1)}%`;
        const growthMetricLabel = targetKpi.kpi === 'revenue' ? 'Revenue Growth %' : `${targetKpi.label} Growth %`;

        cards.push({
          kpi: 'growth',
          label: growthMetricLabel,
          value: growthValue,
          formattedValue: growthFormatted,
          deltaPct: null,
          deltaDirection: comp.deltaDirection,
          period: comp.period
        });
      }
    }

    return cards;
  }

  static async generateCharts(dataSource, mappedCols, filters, domain = 'general') {
    const suggestions = await ChartRecommendationService.recommendCharts(dataSource.schema, domain);
    const charts = [];

    for (let i = 0; i < suggestions.length; i++) {
      const sugg = suggestions[i];
      let { chartType, xField, yField, aggregation } = sugg;

      // Replace AVG of quantity by order_id with Average quantity per customer (group by customer_id)
      let customTitle = null;
      if ((xField || '').toLowerCase() === 'order_id' && (yField || '').toLowerCase() === 'quantity' && (aggregation || '').toLowerCase() === 'avg') {
        const custCol = dataSource.schema.find(c => /customer_id|customer|cust/i.test(c.column));
        if (custCol) {
          xField = custCol.column;
          customTitle = 'Average quantity per customer';
        }
      }

      const baseMatch = await buildMatchStage(dataSource, mappedCols, filters);
      const xCol = dataSource.schema.find(c => c.column === xField);
      const yCol = yField && yField !== '_count' ? dataSource.schema.find(c => c.column === yField) : null;
      const isDate = Boolean(
        xCol && (
          xCol.type === 'date' ||
          xCol.semanticRole === 'temporal_dimension' ||
          xCol.isTemporal ||
          /date|time|day|month|year|timestamp|created_at|updated_at|period/i.test(xField)
        )
      );
      const isScatter = yCol && aggregation === 'none';

      let pipeline = [];
      pipeline.push({ $match: baseMatch });

      if (isScatter || aggregation === 'none') {
        pipeline.push({
          $project: {
            _id: 0,
            x: `$data.${xField}`,
            y: yCol ? `$data.${yField}` : null
          }
        });
        pipeline.push({ $limit: 100 });
      } else if (isDate) {
        // Temporal charts: use granularity-aware aggregation instead of naive exact-date grouping
        try {
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
          // Replace the pipeline (after the $match) with the temporal stages
          pipeline = [
            { $match: baseMatch },
            // Filter out null date values before temporal grouping
            { $match: { [`data.${xField}`]: { $ne: null, $exists: true } } },
            ...temporal.pipeline.filter(s => !s.$match) // temporal pipeline already has its own internal $match
          ];
        } catch (temporalErr) {
          console.error(`[AnalyticsService] Temporal pipeline error for "${xField}": ${temporalErr.message}. Falling back to categorical grouping.`);
          // Fallback to basic grouping
          let groupStage = { _id: `$data.${xField}` };
          groupStage.yVal = aggregation === 'sum' ? { $sum: `$data.${yField}` } : { $sum: 1 };
          pipeline.push({ $group: groupStage });
          pipeline.push({ $project: { _id: 0, x: '$_id', y: '$yVal' } });
          pipeline.push({ $sort: { x: 1 } });
        }
      } else {
        let groupStage = { _id: `$data.${xField}` };

        if (aggregation === 'count') {
          groupStage.yVal = { $sum: 1 };
        } else if (aggregation === 'sum') {
          groupStage.yVal = { $sum: `$data.${yField}` };
        } else if (aggregation === 'avg') {
          groupStage.yVal = { $avg: `$data.${yField}` };
        } else if (aggregation === 'min') {
          groupStage.yVal = { $min: `$data.${yField}` };
        } else if (aggregation === 'max') {
          groupStage.yVal = { $max: `$data.${yField}` };
        } else {
          // Default to count for any unhandled aggregation
          groupStage.yVal = { $sum: 1 };
        }

        pipeline.push({ $group: groupStage });
        pipeline.push({ $project: { _id: 0, x: '$_id', y: '$yVal' } });

        if (isDate) {
          pipeline.push({ $sort: { x: 1 } });
        } else {
          pipeline.push({ $sort: { y: -1 } });
        }
      }

      let results = await DataRow.aggregate(pipeline);

      // Clean/format date values if XAxis is date (backward compat for non-temporal pipeline paths)
      if (isDate) {
        results = results.map(r => {
          let dateStr = r.x;
          if (r.x instanceof Date) {
            dateStr = r.x.toISOString().split('T')[0];
          } else if (r.x && typeof r.x === 'string' && !isNaN(Date.parse(r.x))) {
            // Already a formatted string from $dateToString — keep as-is
            dateStr = r.x;
          } else if (r.x && typeof r.x === 'object') {
            dateStr = JSON.stringify(r.x);
          }
          return { ...r, x: dateStr };
        });
      }

      // Only apply downsampling with 'Other' for non-temporal categorical charts
      // Temporal charts are already aggregated into correct buckets by buildTemporalPipeline
      const maxPoints = 100;
      if (!isDate && results.length > maxPoints) {
        const topSlice = results.slice(0, maxPoints - 1);
        const otherSlice = results.slice(maxPoints - 1);
        const otherSum = otherSlice.reduce((acc, row) => acc + (row.y || 0), 0);
        results = [...topSlice, { x: 'Other', y: otherSum }];
      } else if (isDate && results.length > maxPoints) {
        const step = Math.ceil(results.length / maxPoints);
        results = results.filter((_, idx) => idx % step === 0).slice(0, maxPoints);
      }

      // Run linear forecast on line chart (time series) using AnalyticsEngine
      let forecastData = [];
      if (chartType === 'line' && results.length >= 2) {
        forecastData = await AnalyticsEngine.forecastSeries(results, 7);
      }

      charts.push({
        id: `widget-${i + 2}`,
        type: chartType === 'kpi' ? 'kpi-card' : `${chartType}-chart`,
        // Use title from semantic pipeline if provided, else generate from field names
        title: customTitle || sugg.title || this.generateChartTitle(xField, yField, aggregation),
        config: { xField, yField, aggregation },
        layout: { x: (i % 2) * 6, y: Math.floor(i / 2) * 4, w: 6, h: 4 },
        resolvedData: results,
        forecast: forecastData
      });
    }

    return charts;
  }

  static async generateFilters(dataSource) {
    const filters = {};
    const schema = dataSource.schema || [];

    for (const col of schema) {
      if (col.type === 'categorical' || col.type === 'boolean') {
        const distinct = await DataRow.distinct(`data.${col.column}`, {
          dataSourceId: dataSource._id,
          orgId: dataSource.orgId
        });
        const clean = distinct.filter(v => v !== null && v !== undefined && v !== '');
        if (clean.length > 0) {
          filters[col.column] = clean.slice(0, 25);
        }
      }
    }
    return filters;
  }

  static generateReports(dataSource, kpis) {
    return {
      fileName: dataSource.fileName,
      rowCount: dataSource.rowCount,
      variablesCount: dataSource.schema.length,
      problemCount: dataSource.validation?.problemCount || 0,
      cleanliness: dataSource.validation?.problemCount > 0
        ? `${Math.max(0, 100 - Math.round((dataSource.validation.problemCount / dataSource.rowCount) * 100))}%`
        : "100%",
      status: dataSource.status,
      schema: dataSource.schema
    };
  }

  static async generateDashboard(dataSource, filters = {}) {
    // Step 1: Classify domain FIRST — used by all downstream AI services
    const classification = await DatasetClassifierService.classifyDataset(dataSource.fileName, dataSource.schema);
    const { domain, domainLabel } = classification;

    console.log(`[AnalyticsService] Domain detected: "${domain}" (confidence: ${classification.confidence}) for "${dataSource.fileName}"`);

    // Step 2: Semantic pipeline — KPI column mapping with aggregation validation
    // The pipeline runs semantic classification + domain profiles + AI enrichment + validation
    // Chart recommendation also uses the same pipeline (cached internally)
    const mappedColsList = await KPIRecommendationService.recommendKPIs(dataSource.schema, domain);
    const activeKPIs = this.getActiveKPIList(dataSource, mappedColsList);

    console.log(`[AnalyticsService] KPI mappings (${activeKPIs.length}):`, activeKPIs.map(k => `${k.label}(${k.column}, ${k.aggregation})`).join(', '));

    const mappedCols = {};
    dataSource.schema.forEach(c => {
      mappedCols[c.column] = c.column;
    });
    activeKPIs.forEach(m => {
      mappedCols[m.kpi] = m.column;
    });

    // Step 3: Calculate KPIs from MongoDB (aggregation queries)
    // Aggregation is now determined by semantic pipeline, not heuristic
    const rawKpis = await this.calculateKPIs(dataSource, activeKPIs, filters);

    // Post-execution KPI result validation
    const kpis = rawKpis.filter(kpi => {
      const v = validateKPIResult(kpi);
      if (!v.valid) console.warn(`[AnalyticsService] KPI result rejected — "${kpi.kpi || kpi.label}": ${v.reason}`);
      return v.valid;
    });

    console.log(`[AnalyticsService] KPI cards computed: ${rawKpis.length}, valid: ${kpis.length}`);

    // Step 4: Semantic chart recommendations with aggregation validation gate
    const rawCharts = await this.generateCharts(dataSource, mappedCols, filters, domain);

    // Post-execution chart result validation
    const charts = rawCharts.filter(chart => {
      const v = validateChartResult(chart);
      if (!v.valid) console.warn(`[AnalyticsService] Chart result rejected — "${chart.title}": ${v.reason}`);
      if (v.warning) console.warn(`[AnalyticsService] Chart result warning — "${chart.title}": ${v.warning}`);
      return v.valid;
    });

    console.log(`[AnalyticsService] Charts computed: ${rawCharts.length}, valid: ${charts.length}`);
    // Step 5: Rule Engine evaluation
    const ruleAlerts = await RuleEngineService.evaluateRules(dataSource._id);

    // Step 6: AI-powered insights with full dataset sample context
    const sampleRowsRaw = await DataRow.find({ dataSourceId: dataSource._id, orgId: dataSource.orgId }).limit(100).lean();
    const sampleRows = sampleRowsRaw.map(r => r.data);

    const insights = await InsightGeneratorService.generateInsights({
      kpis,
      charts,
      data: sampleRows,
      domain,
      domainLabel: domainLabel || domain,
      ruleAlerts
    });

    // Step 7: Filters and reports
    const filterOptions = await this.generateFilters(dataSource);
    const reports = this.generateReports(dataSource, kpis);

    const recommendations = [];
    if (dataSource.validation?.problemCount > 0) {
      recommendations.push({
        type: 'quality',
        message: 'Resolve missing cells in your dataset to increase insight accuracy.'
      });
    }
    ruleAlerts.forEach(alert => {
      recommendations.push({
        type: alert.severity,
        message: `Rule Triggered: ${alert.label} matched ${alert.triggeredCount} rows.`
      });
    });

    return {
      domain,
      domainLabel: domainLabel || domain,
      confidence: classification.confidence,
      kpis,
      charts,
      insights,
      filters: filterOptions,
      reports,
      recommendations
    };
  }

  static async persistAnalytics(dataSourceId, orgId) {
    const dataSource = await DataSource.findOne({ _id: dataSourceId, orgId }).lean();
    if (!dataSource) return null;

    const data = await this.generateDashboard(dataSource, {});

    let analytics = await Analytics.findOne({ dataSourceId, orgId });
    if (analytics) {
      analytics.kpis = data.kpis;
      analytics.charts = data.charts;
      analytics.insights = data.insights;
      analytics.filters = data.filters;
      analytics.reports = data.reports;
      analytics.recommendations = data.recommendations;
      analytics.updatedAt = new Date();
      await analytics.save();
    } else {
      analytics = new Analytics({
        dataSourceId,
        orgId,
        kpis: data.kpis,
        charts: data.charts,
        insights: data.insights,
        filters: data.filters,
        reports: data.reports,
        recommendations: data.recommendations
      });
      await analytics.save();
    }

    return analytics;
  }
}

module.exports = AnalyticsService;
