const { generateInsights, computeKpis, computeChartStats } = require('../../src/services/ai/insightGenerator');
const { updateInsights } = require('../../src/repositories/datasetRepository');

// Mock the repository to avoid MongoDB connection requirements during unit tests
jest.mock('../../src/repositories/datasetRepository', () => ({
  updateInsights: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('Insight Generator Service', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockMetadata = {
    rowCount: 10,
    columns: [
      { name: 'revenue', inferredType: 'currency', uniqueValueCount: 10 },
      { name: 'units_sold', inferredType: 'numeric', uniqueValueCount: 10 }
    ]
  };

  const mockKpis = [
    { name: 'Total Revenue', sourceColumns: ['revenue'], aggregation: 'sum', priority: 'primary' },
    { name: 'Average Units Sold', sourceColumns: ['units_sold'], aggregation: 'avg', priority: 'secondary' }
  ];

  const mockCharts = [
    { title: 'Revenue Over Time', type: 'line', xAxis: 'date', yAxis: 'revenue' }
  ];

  const mockSampleRows = [
    { date: '2023-01-01', revenue: 100, units_sold: 5 },
    { date: '2023-01-02', revenue: 200, units_sold: 15 }
  ];

  // Helper Tests
  it('should correctly pre-aggregate KPI sums, counts, and averages', () => {
    const computed = computeKpis(mockKpis, mockSampleRows);
    
    expect(computed).toHaveLength(2);
    
    const revenueKpi = computed.find(k => k.name === 'Total Revenue');
    expect(revenueKpi.value).toBe(300); // 100 + 200

    const unitsKpi = computed.find(k => k.name === 'Average Units Sold');
    expect(unitsKpi.value).toBe(10); // (5 + 15) / 2
  });

  it('should correctly pre-aggregate chart summary statistics', () => {
    const computed = computeChartStats(mockCharts, mockSampleRows);

    expect(computed).toHaveLength(1);
    expect(computed[0].stats).toEqual({
      min: 100,
      max: 200,
      avg: 150,
      count: 2
    });
  });

  // Main Generator Tests
  it('should successfully call Gemini with stats and merge generated insights', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                insights: [
                  {
                    category: 'finding',
                    text: 'Total revenue reached $300 across 2 transactions.',
                    relatedKpi: 'Total Revenue',
                    severity: 'info'
                  },
                  {
                    category: 'warning',
                    text: 'Anomalous revenue spikes detected reaching up to $200.',
                    relatedKpi: 'Total Revenue',
                    severity: 'warning'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await generateInsights('mock-dataset-id', {
      datasetType: 'Sales',
      kpis: mockKpis,
      charts: mockCharts,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('finding');
    expect(result[0].text).toContain('$300');
    expect(result[1].category).toBe('warning');

    expect(updateInsights).toHaveBeenCalledTimes(1);
    expect(updateInsights).toHaveBeenCalledWith('mock-dataset-id', result);
  });

  it('should fallback to an empty insights array on LLM execution failure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'broken json'
            }]
          }
        }]
      })
    });

    const result = await generateInsights('mock-dataset-id', {
      datasetType: 'Sales',
      kpis: mockKpis,
      charts: mockCharts,
      sampleRows: mockSampleRows
    });

    expect(result).toEqual([]);
    expect(updateInsights).toHaveBeenCalledTimes(1);
    expect(updateInsights).toHaveBeenCalledWith('mock-dataset-id', []);
  });
});
