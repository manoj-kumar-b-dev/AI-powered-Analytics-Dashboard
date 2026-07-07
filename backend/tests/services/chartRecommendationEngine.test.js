const { recommendCharts } = require('../../src/services/ai/chartRecommendationEngine');
const { updateCharts } = require('../../src/repositories/datasetRepository');

// Mock the repository to avoid MongoDB connection requirements during unit tests
jest.mock('../../src/repositories/datasetRepository', () => ({
  updateCharts: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('Chart Recommendation Engine Service', () => {
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
      { name: 'date', inferredType: 'date', uniqueValueCount: 10 },
      { name: 'revenue', inferredType: 'currency', uniqueValueCount: 10 },
      { name: 'category', inferredType: 'text', uniqueValueCount: 3 },
      { name: 'customer_id', inferredType: 'text', uniqueValueCount: 10 },
      { name: 'email', inferredType: 'text', uniqueValueCount: 10 }
    ]
  };

  const mockColumnRoles = [
    { columnName: 'date', detectedType: 'date', businessRole: 'dimension' },
    { columnName: 'revenue', detectedType: 'currency', businessRole: 'metric' },
    { columnName: 'category', detectedType: 'category', businessRole: 'dimension' },
    { columnName: 'customer_id', detectedType: 'identifier', businessRole: 'identifier' },
    { columnName: 'email', detectedType: 'text', businessRole: 'ignore' }
  ];

  const mockKpis = [
    { name: 'Total Revenue', sourceColumns: ['revenue'], aggregation: 'sum', priority: 'primary' }
  ];

  const mockSampleRows = [
    { date: '2023-01-01', revenue: 100, category: 'A', customer_id: 'C01', email: 'a@b.com' }
  ];

  // 1. Successful Sales Chart recommendation
  it('should successfully recommend and persist valid trend and category breakdown charts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                charts: [
                  {
                    title: 'Revenue Over Time',
                    type: 'line',
                    xAxis: 'date',
                    yAxis: 'Total Revenue',
                    reason: 'Shows performance trends.'
                  },
                  {
                    title: 'Revenue by Category',
                    type: 'bar',
                    xAxis: 'category',
                    yAxis: 'revenue',
                    reason: 'Shows product performance.'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendCharts('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      kpis: mockKpis,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Revenue Over Time');
    expect(result[1].title).toBe('Revenue by Category');

    expect(updateCharts).toHaveBeenCalledTimes(1);
    expect(updateCharts).toHaveBeenCalledWith('mock-dataset-id', result);
  });

  // 2. Unsafe Column Filter
  it('should strip charts referencing identifier or ignore columns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                charts: [
                  {
                    title: 'Revenue by Category',
                    type: 'bar',
                    xAxis: 'category',
                    yAxis: 'revenue',
                    reason: 'Valid.'
                  },
                  {
                    title: 'Unsafe Chart 1',
                    type: 'bar',
                    xAxis: 'customer_id', // identifier!
                    yAxis: 'revenue',
                    reason: 'Unsafe.'
                  },
                  {
                    title: 'Unsafe Chart 2',
                    type: 'line',
                    xAxis: 'date',
                    yAxis: 'revenue',
                    groupBy: 'email', // ignore!
                    reason: 'Unsafe.'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendCharts('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      kpis: mockKpis,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    // Unsafe charts are stripped, leaving only the Category breakdown
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Revenue by Category');
  });

  // 3. Deduplication Check
  it('should deduplicate charts with the same type and axes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                charts: [
                  {
                    title: 'Revenue by Category',
                    type: 'bar',
                    xAxis: 'category',
                    yAxis: 'revenue',
                    reason: 'Primary choice.'
                  },
                  {
                    title: 'Category Sales Breakdown',
                    type: 'bar', // same type, same xAxis, same yAxis!
                    xAxis: 'category',
                    yAxis: 'revenue',
                    reason: 'Duplicate choice.'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendCharts('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      kpis: mockKpis,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Revenue by Category');
  });

  // 4. Variety round-robin selector
  it('should interleave chart types to prioritize variety in final results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                charts: [
                  { title: 'L1', type: 'line', xAxis: 'date', yAxis: 'revenue', reason: '' },
                  { title: 'L2', type: 'line', xAxis: 'date', yAxis: 'revenue', reason: '' },
                  { title: 'L3', type: 'line', xAxis: 'date', yAxis: 'revenue', reason: '' },
                  { title: 'B1', type: 'bar', xAxis: 'category', yAxis: 'revenue', reason: '' },
                  { title: 'B2', type: 'bar', xAxis: 'category', yAxis: 'revenue', reason: '' }
                ]
              })
            }]
          }
        }]
      })
    });

    // Make sure we bypass deduplication for this test by supplying slightly different axes or we can just bypass deduplication check by varying xAxis / yAxis
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                charts: [
                  { title: 'L1', type: 'line', xAxis: 'date', yAxis: 'revenue', reason: '' },
                  { title: 'L2', type: 'line', xAxis: 'date', yAxis: 'Total Revenue', reason: '' },
                  { title: 'B1', type: 'bar', xAxis: 'category', yAxis: 'revenue', reason: '' },
                  { title: 'B2', type: 'bar', xAxis: 'category', yAxis: 'Total Revenue', reason: '' }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendCharts('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      kpis: mockKpis,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(4);
    // Variety round robin should alternate line and bar
    expect(result[0].type).toBe('line'); // L1
    expect(result[1].type).toBe('bar');  // B1
    expect(result[2].type).toBe('line'); // L2
    expect(result[3].type).toBe('bar');  // B2
  });

  // 5. Graceful degradation on AI failure
  it('should gracefully return an empty array on AI execution failure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'broken response'
            }]
          }
        }]
      })
    });

    const result = await recommendCharts('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      kpis: mockKpis,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toEqual([]);
    expect(updateCharts).toHaveBeenCalledTimes(1);
    expect(updateCharts).toHaveBeenCalledWith('mock-dataset-id', []);
  });
});
