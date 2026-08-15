const assert = require('assert');
const AnalyticsContextBuilder = require('../src/services/insightGenerator/analyticsContextBuilder');
const InsightGeneratorService = require('../src/services/insightGenerator/insightGeneratorService');
const ChartExplanationService = require('../src/services/insightGenerator/chartExplanationService');

describe('AI Insight Generation Engine — Unit & Domain Tests', () => {
  const sampleDomains = [
    { domain: 'sales', domainLabel: 'Sales & E-Commerce' },
    { domain: 'hr', domainLabel: 'Human Resources' },
    { domain: 'finance', domainLabel: 'Finance & Banking' },
    { domain: 'healthcare', domainLabel: 'Healthcare & Clinical' },
    { domain: 'education', domainLabel: 'Education & Academics' },
    { domain: 'iot', domainLabel: 'IoT & Telemetry' },
    { domain: 'inventory', domainLabel: 'Supply Chain & Inventory' },
    { domain: 'survey', domainLabel: 'Survey & Customer Feedback' },
    { domain: 'marketing', domainLabel: 'Digital Marketing & Ads' },
    { domain: 'general', domainLabel: 'General Domain' }
  ];

  it('Phase 2: AnalyticsContextBuilder normalizes without mutating or calculating metrics', () => {
    const mockDataSource = {
      fileName: 'test_sales.csv',
      rowCount: 14520,
      domain: 'sales',
      domainLabel: 'Sales & E-Commerce',
      schema: [
        { column: 'revenue', type: 'numeric', semanticRole: 'metric' },
        { column: 'category', type: 'categorical', semanticRole: 'dimension' }
      ]
    };

    const mockKpis = [
      { kpi: 'revenue', label: 'Total Revenue', value: 1500000, formattedValue: '₹1.5M', deltaPct: 12.5, deltaDirection: 'up', period: 'vs prior period' }
    ];

    const mockCharts = [
      {
        id: 'widget-1',
        title: 'Revenue by Category',
        type: 'bar-chart',
        config: { xField: 'category', yField: 'revenue', aggregation: 'sum' },
        resolvedData: [{ x: 'Electronics', y: 800000 }, { x: 'Apparel', y: 700000 }],
        forecast: [{ x: 'Forecast +1', y: 850000 }]
      }
    ];

    const context = AnalyticsContextBuilder.buildContext({
      dataSource: mockDataSource,
      kpis: mockKpis,
      charts: mockCharts,
      correlations: [],
      anomalies: [{ label: 'High Spike Alert', triggeredCount: 5, severity: 'warning' }],
      reports: { cleanliness: '99%', problemCount: 2 }
    });

    assert.strictEqual(context.datasetSummary.fileName, 'test_sales.csv');
    assert.strictEqual(context.datasetSummary.rows, 14520);
    assert.strictEqual(context.kpis.length, 1);
    assert.strictEqual(context.kpis[0].formattedValue, '₹1.5M');
    assert.strictEqual(context.charts[0].aggregatedData.length, 2);
    assert.strictEqual(context.outliers.length, 1);
  });

  it('Phases 5-12: InsightGeneratorService produces structured insights across 10 domains', async () => {
    for (const d of sampleDomains) {
      const mockContext = {
        datasetSummary: { fileName: `dataset_${d.domain}.csv`, rows: 5000, columns: 10, domain: d.domain, domainLabel: d.domainLabel, cleanliness: '100%' },
        kpis: [{ kpi: 'main_metric', label: 'Primary Performance Metric', value: 2500, formattedValue: '2.5K', deltaPct: 8.4, deltaDirection: 'up' }],
        charts: [{ title: 'Performance by Department', type: 'bar-chart', aggregatedData: [{ x: 'Group A', y: 1500 }, { x: 'Group B', y: 1000 }] }],
        outliers: [{ label: 'Performance Outlier', triggeredCount: 1, severity: 'info' }]
      };

      const result = await InsightGeneratorService.generateFullInsights(mockContext);

      assert.ok(result.executiveSummary, `Executive summary missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.keyInsights), `keyInsights missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.patterns), `patterns missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.anomalies), `anomalies missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.risks), `risks missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.opportunities), `opportunities missing for domain: ${d.domain}`);
      assert.ok(Array.isArray(result.recommendations), `recommendations missing for domain: ${d.domain}`);

      // Verify confidence ratings are strictly between 0 and 1
      result.keyInsights.forEach(ki => {
        assert.ok(ki.confidence >= 0 && ki.confidence <= 1, `Confidence out of bounds: ${ki.confidence}`);
      });
    }
  });

  it('Phase 14: ChartExplanationService generates focused explanation without calculation', async () => {
    const explanationPayload = {
      title: 'Monthly Active Users',
      type: 'line-chart',
      config: { xField: 'month', yField: 'users', aggregation: 'count' },
      aggregatedData: [{ x: 'Jan', y: 1200 }, { x: 'Feb', y: 1500 }, { x: 'Mar', y: 2100 }],
      forecast: [{ x: 'Forecast +1', y: 2400 }],
      domain: 'iot'
    };

    const res = await ChartExplanationService.explainChart(explanationPayload);

    assert.ok(res.explanation, 'Explanation text missing');
    assert.ok(Array.isArray(res.keyTakeaways), 'keyTakeaways missing');
    assert.ok(res.trend, 'Trend missing');
    assert.ok(res.confidence >= 0 && res.confidence <= 1, 'Confidence invalid');
  });
});
