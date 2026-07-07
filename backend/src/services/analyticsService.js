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
  const formattedVal = val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });

  return isCurrency ? `$${formattedVal}${suffix}` : `${formattedVal}${suffix}`;
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

  static async calculateKPIs(dataSource, mappedCols, filters) {
    const revCol = mappedCols.revenue;
    const salesCol = mappedCols.sales;
    const custCol = mappedCols.customers;
    const expCol = mappedCols.expenses;
    const profitCol = mappedCols.profit;
    const dateCol = mappedCols.date;

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

    const groupStage = {
      _id: null,
      totalRevenue: revCol ? (
        periodBounds ? { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, periodBounds.currentStart] }, `$data.${revCol}`, 0] } } : { $sum: `$data.${revCol}` }
      ) : { $sum: 0 },
      totalSales: salesCol ? (
        periodBounds ? { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, periodBounds.currentStart] }, `$data.${salesCol}`, 0] } } : { $sum: `$data.${salesCol}` }
      ) : { $sum: 1 },
      totalExpenses: expCol ? (
        periodBounds ? { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, periodBounds.currentStart] }, `$data.${expCol}`, 0] } } : { $sum: `$data.${expCol}` }
      ) : { $sum: 0 },
      totalProfit: profitCol ? (
        periodBounds ? { $sum: { $cond: [{ $gte: [`$data.${dateCol}`, periodBounds.currentStart] }, `$data.${profitCol}`, 0] } } : { $sum: `$data.${profitCol}` }
      ) : { $sum: 0 },
    };

    if (dateCol && periodBounds) {
      const { currentStart, priorStart, priorEnd } = periodBounds;

      groupStage.currentRowCount = {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, 1, 0] }
      };

      groupStage.priorRevenue = revCol ? {
        $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${revCol}`, 0] }
      } : { $sum: 0 };
      groupStage.currentRevenue = revCol ? {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${revCol}`, 0] }
      } : { $sum: 0 };      
      groupStage.priorSales = salesCol ? {
        $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${salesCol}`, 0] }
      } : {
        $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, 1, 0] }
      };
      groupStage.currentSales = salesCol ? {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${salesCol}`, 0] }
      } : {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, 1, 0] }
      };

      groupStage.priorExpenses = expCol ? {
        $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${expCol}`, 0] }
      } : { $sum: 0 };
      groupStage.currentExpenses = expCol ? {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${expCol}`, 0] }
      } : { $sum: 0 };

      groupStage.priorProfit = profitCol ? {
        $sum: { $cond: [{ $and: [{ $gte: [`$data.${dateCol}`, priorStart] }, { $lt: [`$data.${dateCol}`, priorEnd] }] }, `$data.${profitCol}`, 0] }
      } : { $sum: 0 };
      groupStage.currentProfit = profitCol ? {
        $sum: { $cond: [{ $gte: [`$data.${dateCol}`, currentStart] }, `$data.${profitCol}`, 0] }
      } : { $sum: 0 };
    }

    const totalsResult = await DataRow.aggregate([
      { $match: baseMatchNoDate },
      { $group: groupStage }
    ]);

    const totals = totalsResult[0] || {
      totalRevenue: 0, totalSales: 0, totalExpenses: 0, totalProfit: 0,
      priorRevenue: 0, currentRevenue: 0, priorSales: 0, currentSales: 0,
      priorExpenses: 0, currentExpenses: 0, priorProfit: 0, currentProfit: 0,
      currentRowCount: 0
    };

    let totalCust = 0, priorCust = 0, currentCust = 0;
    if (custCol) {
      const custResult = await DataRow.aggregate([
        { $match: baseMatchNoDate },
        {
          $group: {
            _id: `$data.${custCol}`
          }
        },
        { $count: "total" }
      ]);
      totalCust = custResult[0]?.total || 0;

      if (dateCol && periodBounds) {
        const { currentStart, priorStart, priorEnd } = periodBounds;

        const priorCustResult = await DataRow.aggregate([
          { $match: { ...baseMatchNoDate, [`data.${dateCol}`]: { $gte: priorStart, $lt: priorEnd } } },
          {
            $group: {
              _id: `$data.${custCol}`
            }
          },
          { $count: "total" }
        ]);
        priorCust = priorCustResult[0]?.total || 0;

        const currentCustResult = await DataRow.aggregate([
          { $match: { ...baseMatchNoDate, [`data.${dateCol}`]: { $gte: currentStart } } },
          {
            $group: {
              _id: `$data.${custCol}`
            }
          },
          { $count: "total" }
        ]);
        currentCust = currentCustResult[0]?.total || 0;
      }
    }

    const buildCard = (kpiName, label, val, isCurrency, priorVal, currentVal) => {
      let deltaPct = null;
      let deltaDirection = 'flat';
      let period = null;

      if (dateCol && periodBounds && priorVal !== undefined && currentVal !== undefined) {
        if (totals.currentRowCount === 0) {
          deltaPct = null;
          deltaDirection = 'flat';
          period = 'No data for this period';
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

      return {
        kpi: kpiName,
        label,
        value: val,
        formattedValue: isCurrency ? `$${val.toLocaleString()}` : val.toLocaleString(),
        deltaPct,
        deltaDirection,
        period: period || (dateCol && periodBounds ? 'vs prior period' : null)
      };
    };

    const cards = [
      buildCard('revenue', 'Total Revenue', totals.totalRevenue, true, totals.priorRevenue, totals.currentRevenue),
      buildCard('sales', 'Total Quantity Sold', totals.totalSales, false, totals.priorSales, totals.currentSales)
    ];

    if (custCol) {
      cards.push(buildCard('customers', 'Total Customers', totalCust, false, priorCust, currentCust));
    }
    if (expCol) {
      cards.push(buildCard('expenses', 'Total Expenses', totals.totalExpenses, true, totals.priorExpenses, totals.currentExpenses));
    }
    if (profitCol) {
      cards.push(buildCard('profit', 'Net Profit', totals.totalProfit, true, totals.priorProfit, totals.currentProfit));
    }

    if (dateCol && periodBounds) {
      let growthMetricLabel = 'Growth %';
      let growthPct = 0;
      let growthDirection = 'flat';

      if (revCol) {
        growthMetricLabel = 'Revenue Growth %';
        const prior = totals.priorRevenue;
        const current = totals.currentRevenue;
        
        if (totals.currentRowCount === 0) {
          growthPct = 0;
          growthDirection = 'flat';
        } else {
          growthPct = prior === 0 ? (current > 0 ? 100 : 0) : ((current - prior) / Math.abs(prior)) * 100;
          growthDirection = current - prior > 0 ? 'up' : current - prior < 0 ? 'down' : 'flat';
        }
      } else {
        growthMetricLabel = 'Sales Growth %';
        const prior = totals.priorSales;
        const current = totals.currentSales;
        
        if (totals.currentRowCount === 0) {
          growthPct = 0;
          growthDirection = 'flat';
        } else {
          growthPct = prior === 0 ? (current > 0 ? 100 : 0) : ((current - prior) / Math.abs(prior)) * 100;
          growthDirection = current - prior > 0 ? 'up' : current - prior < 0 ? 'down' : 'flat';
        }
      }

      cards.push({
        kpi: 'growth',
        label: growthMetricLabel,
        value: growthPct,
        formattedValue: `${growthPct.toFixed(1)}%`,
        deltaPct: null,
        deltaDirection: growthDirection,
        period: totals.currentRowCount === 0 ? 'No data for this period' : 'vs prior period'
      });
    }

    return cards;
  }

  static async generateCharts(dataSource, mappedCols, filters, domain = 'general') {
    const suggestions = await ChartRecommendationService.recommendCharts(dataSource.schema, domain);
    const charts = [];

    for (let i = 0; i < suggestions.length; i++) {
      const sugg = suggestions[i];
      const { chartType, xField, yField, aggregation } = sugg;

      const baseMatch = await buildMatchStage(dataSource, mappedCols, filters);
      const xCol = dataSource.schema.find(c => c.column === xField);
      const yCol = yField && yField !== '_count' ? dataSource.schema.find(c => c.column === yField) : null;
      const isDate = xCol && xCol.type === 'date';
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
      } else {
        let groupStage = { _id: `$data.${xField}` };

        if (aggregation === 'count') {
          groupStage.yVal = { $sum: 1 };
        } else if (aggregation === 'sum') {
          groupStage.yVal = { $sum: `$data.${yField}` };
        } else if (aggregation === 'avg') {
          groupStage.yVal = { $avg: `$data.${yField}` };
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

      const maxPoints = 100;
      if (results.length > maxPoints) {
        if (isDate) {
          const interval = Math.ceil(results.length / maxPoints);
          results = results.filter((_, index) => index % interval === 0).slice(0, maxPoints);
        } else {
          const topSlice = results.slice(0, maxPoints - 1);
          const otherSlice = results.slice(maxPoints - 1);
          const otherSum = otherSlice.reduce((acc, row) => acc + (row.y || 0), 0);
          results = [...topSlice, { x: 'Other', y: otherSum }];
        }
      }

      // Run linear forecast on line chart (time series) using AnalyticsEngine
      let forecastData = [];
      if (chartType === 'line' && results.length >= 2) {
        forecastData = await AnalyticsEngine.forecastSeries(results, 7);
      }

      charts.push({
        id: `widget-${i + 2}`,
        type: chartType === 'kpi' ? 'kpi-card' : `${chartType}-chart`,
        title: `${yField === '_count' ? 'Count' : aggregation.toUpperCase() + ' of ' + yField} by ${xField}`,
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

    // Step 2: AI-powered KPI column mapping (Gemini suggests which columns = which KPIs)
    const mappedColsList = await KPIRecommendationService.recommendKPIs(dataSource.schema, domain);
    const mappedCols = {};
    dataSource.schema.forEach(c => {
      mappedCols[c.column] = c.column;
    });
    mappedColsList.forEach(m => {
      mappedCols[m.kpi] = m.column;
    });
    // Apply any manual overrides from the Upload tab KPI mapping UI
    if (dataSource.kpiMapping) {
      Object.keys(dataSource.kpiMapping).forEach(k => {
        if (dataSource.kpiMapping[k]) mappedCols[k] = dataSource.kpiMapping[k];
      });
    }

    // Step 3: Calculate KPIs from MongoDB (aggregation queries)
    const kpis = await this.calculateKPIs(dataSource, mappedCols, filters);

    // Enrich KPI cards with Gemini-suggested metadata (icon, color, label)
    // mappedColsList contains the full recommendation including icon/color from Gemini
    const kpiMetaMap = {};
    mappedColsList.forEach(m => { kpiMetaMap[m.kpi] = m; });
    const enrichedKpis = kpis.map(kpi => {
      const meta = kpiMetaMap[kpi.kpi];
      return {
        ...kpi,
        label: meta?.label || kpi.label,
        icon: meta?.icon || null,
        color: meta?.color || null
      };
    });

    // Step 4: AI-powered chart suggestions (Gemini picks chart types, fields, aggregations)
    const charts = await this.generateCharts(dataSource, mappedCols, filters, domain);

    // Step 5: Rule Engine evaluation
    const ruleAlerts = await RuleEngineService.evaluateRules(dataSource._id);

    // Step 6: AI-powered insights (Gemini generates domain-aware business insights from KPI data)
    const insights = await InsightGeneratorService.generateInsights(enrichedKpis, ruleAlerts, domain, domainLabel || domain);

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
      kpis: enrichedKpis,
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
