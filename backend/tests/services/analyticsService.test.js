const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DataSource = require('../../src/models/dataSource');
const DataRow = require('../../src/models/dataRow');
const AnalyticsService = require('../../src/services/analyticsService');

let mongoServer;

beforeAll(async () => {
  // Disconnect any existing mongoose connection to avoid conflict
  await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await DataSource.deleteMany({});
  await DataRow.deleteMany({});
});

describe('AnalyticsService Period Comparison', () => {
  it('should show "No data for this period" instead of -100% when current period has zero rows for a metric', async () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    // 1. Create a DataSource with a date column and revenue/expenses mappings
    const dataSource = await DataSource.create({
      orgId,
      uploadedBy: userId,
      fileName: 'test_dataset.csv',
      rowCount: 2,
      status: 'confirmed',
      isActive: true,
      schema: [
        { column: 'Date', type: 'date' },
        { column: 'Revenue', type: 'numeric' },
        { column: 'Expenses', type: 'numeric' }
      ],
      kpiMapping: {
        date: 'Date',
        revenue: 'Revenue',
        expenses: 'Expenses'
      }
    });

    // 2. Insert mock data rows
    // Prior period row (with expenses data)
    await DataRow.create({
      orgId,
      dataSourceId: dataSource._id,
      data: {
        Date: new Date('2026-07-01T12:00:00Z'),
        Revenue: 100,
        Expenses: 50
      }
    });

    // Current period row (where expenses is null / missing, but revenue is present)
    await DataRow.create({
      orgId,
      dataSourceId: dataSource._id,
      data: {
        Date: new Date('2026-07-03T12:00:00Z'),
        Revenue: 120,
        Expenses: null
      }
    });

    const mappedColsList = [
      { kpi: 'date', column: 'Date', label: 'Date', format: 'date' },
      { kpi: 'revenue', column: 'Revenue', label: 'Total Revenue', format: 'currency' },
      { kpi: 'expenses', column: 'Expenses', label: 'Total Expenses', format: 'currency' }
    ];

    const cards = await AnalyticsService.calculateKPIs(dataSource, mappedColsList, { date: 'today' });

    // 4. Verify calculations
    const revCard = cards.find(c => c.kpi === 'revenue');
    const expCard = cards.find(c => c.kpi === 'expenses');

    // Revenue has rows in both periods (e.g. 2026-07-02 for current)
    expect(revCard).toBeDefined();
    expect(revCard.deltaPct).not.toBeNull();
    expect(revCard.period).toBe('vs prior period');

    // Expenses has zero rows in the current period, so it should report "No data for this period"
    expect(expCard).toBeDefined();
    expect(expCard.deltaPct).toBeNull();
    expect(expCard.period).toBe('No data for this period');
    expect(expCard.deltaDirection).toBe('flat');
  });

  it('should use consistent period comparison across all KPI cards via the computeComparison utility', () => {
    // Test the computeComparison utility directly with multiple cases
    
    // Case A: No data in current period
    const resA = AnalyticsService.computeComparison({
      currentVal: 0,
      priorVal: 100,
      currentCount: 0,
      priorCount: 5,
      hasDateCol: true,
      hasPeriodBounds: true
    });
    expect(resA.deltaPct).toBeNull();
    expect(resA.deltaDirection).toBe('flat');
    expect(resA.period).toBe('No data for this period');

    // Case B: No data in prior period
    const resB = AnalyticsService.computeComparison({
      currentVal: 150,
      priorVal: 0,
      currentCount: 5,
      priorCount: 0,
      hasDateCol: true,
      hasPeriodBounds: true
    });
    expect(resB.deltaPct).toBeNull();
    expect(resB.deltaDirection).toBe('flat');
    expect(resB.period).toBe('No prior period data for comparison');

    // Case C: Normal positive comparison
    const resC = AnalyticsService.computeComparison({
      currentVal: 150,
      priorVal: 100,
      currentCount: 5,
      priorCount: 5,
      hasDateCol: true,
      hasPeriodBounds: true
    });
    expect(resC.deltaPct).toBe(50);
    expect(resC.deltaDirection).toBe('up');
    expect(resC.period).toBe('vs prior period');

    // Case D: Normal negative comparison
    const resD = AnalyticsService.computeComparison({
      currentVal: 80,
      priorVal: 100,
      currentCount: 5,
      priorCount: 5,
      hasDateCol: true,
      hasPeriodBounds: true
    });
    expect(resD.deltaPct).toBe(-20);
    expect(resD.deltaDirection).toBe('down');
    expect(resD.period).toBe('vs prior period');

    // Case E: flat comparison
    const resE = AnalyticsService.computeComparison({
      currentVal: 100,
      priorVal: 100,
      currentCount: 5,
      priorCount: 5,
      hasDateCol: true,
      hasPeriodBounds: true
    });
    expect(resE.deltaPct).toBe(0);
    expect(resE.deltaDirection).toBe('flat');
    expect(resE.period).toBe('vs prior period');
  });

  it('should generate proper fallback titles for empty/none aggregations', () => {
    const title = AnalyticsService.generateChartTitle('quantity', 'unit_price', 'none');
    expect(title).toBe('Distribution of unit_price by quantity');
  });

  it('should reject ORD-like identifiers from date parsing', () => {
    const { isDateString } = require('../../src/services/parserService');
    expect(isDateString('ORD-10299')).toBe(false);
    expect(isDateString('2025-06-15')).toBe(true);
  });

  it('should substitute average quantity per order_id widget', async () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const dataSource = await DataSource.create({
      orgId,
      uploadedBy: userId,
      fileName: 'sales.csv',
      rowCount: 1,
      status: 'confirmed',
      isActive: true,
      schema: [
        { column: 'order_id', type: 'text' },
        { column: 'customer_id', type: 'text' },
        { column: 'quantity', type: 'numeric' }
      ]
    });

    const suggestionsMock = [
      { chartType: 'bar', xField: 'order_id', yField: 'quantity', aggregation: 'avg' }
    ];

    const ChartRecommendationService = require('../../src/services/chartRecommendation/chartRecommendationService');
    jest.spyOn(ChartRecommendationService, 'recommendCharts').mockResolvedValueOnce(suggestionsMock);

    const charts = await AnalyticsService.generateCharts(dataSource, {}, {});
    expect(charts).toBeDefined();
    expect(charts.length).toBe(1);
    expect(charts[0].config.xField).toBe('customer_id');
    expect(charts[0].title).toBe('Average quantity per customer');
  });
});
