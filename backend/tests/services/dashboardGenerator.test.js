const { generateDashboardConfig } = require('../../src/services/dashboard/dashboardGenerator');
const { saveDashboardConfig } = require('../../src/repositories/datasetRepository');

// Mock repository writes
jest.mock('../../src/repositories/datasetRepository', () => ({
  saveDashboardConfig: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('Dashboard Generator Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate a correct grid layout for KPIs and charts and persist it', async () => {
    const kpis = [
      { name: 'K1', priority: 'primary' },
      { name: 'K2', priority: 'primary' },
      { name: 'K3', priority: 'secondary' },
      { name: 'K4', priority: 'secondary' },
      { name: 'K5', priority: 'secondary' }
    ];

    const charts = [
      { title: 'C1', type: 'line' },
      { title: 'C2', type: 'bar' }
    ];

    const config = await generateDashboardConfig('mock-dataset-id', {
      kpis,
      charts,
      datasetType: 'Sales'
    });

    expect(config.datasetId).toBe('mock-dataset-id');
    expect(config.datasetType).toBe('Sales');
    expect(config.layout).toHaveLength(7); // 5 KPIs + 2 Charts

    // Check KPI 1 (first row, first column)
    expect(config.layout[0]).toEqual({
      widgetId: 'kpi-0',
      type: 'kpi',
      refId: 'K1',
      gridPosition: { x: 0, y: 0, w: 3, h: 2 }
    });

    // Check KPI 4 (first row, last column)
    expect(config.layout[3]).toEqual({
      widgetId: 'kpi-3',
      type: 'kpi',
      refId: 'K4',
      gridPosition: { x: 9, y: 0, w: 3, h: 2 }
    });

    // Check KPI 5 (second row, first column)
    expect(config.layout[4]).toEqual({
      widgetId: 'kpi-4',
      type: 'kpi',
      refId: 'K5',
      gridPosition: { x: 0, y: 2, w: 3, h: 2 }
    });

    // Chart Y should start after KPI row count (2 rows * height 2 = start y is 4)
    expect(config.layout[5]).toEqual({
      widgetId: 'chart-0',
      type: 'chart',
      refId: 'C1',
      gridPosition: { x: 0, y: 4, w: 6, h: 4 }
    });

    expect(config.layout[6]).toEqual({
      widgetId: 'chart-1',
      type: 'chart',
      refId: 'C2',
      gridPosition: { x: 6, y: 4, w: 6, h: 4 }
    });

    expect(saveDashboardConfig).toHaveBeenCalledTimes(1);
    expect(saveDashboardConfig).toHaveBeenCalledWith('mock-dataset-id', config);
  });
});
