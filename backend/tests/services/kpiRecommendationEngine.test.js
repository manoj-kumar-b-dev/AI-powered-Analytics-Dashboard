const { recommendKpis } = require('../../src/services/ai/kpiRecommendationEngine');
const { updateKpis } = require('../../src/repositories/datasetRepository');

// Mock the repository to avoid MongoDB connection requirements during unit tests
jest.mock('../../src/repositories/datasetRepository', () => ({
  updateKpis: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('KPI Recommendation Engine Service', () => {
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
      { name: 'units_sold', inferredType: 'numeric', uniqueValueCount: 10 },
      { name: 'customer_id', inferredType: 'text', uniqueValueCount: 10 },
      { name: 'email', inferredType: 'text', uniqueValueCount: 10 }
    ]
  };

  const mockColumnRoles = [
    { columnName: 'revenue', detectedType: 'currency', businessRole: 'metric' },
    { columnName: 'units_sold', detectedType: 'numeric', businessRole: 'metric' },
    { columnName: 'customer_id', detectedType: 'identifier', businessRole: 'identifier' },
    { columnName: 'email', detectedType: 'text', businessRole: 'ignore' }
  ];

  const mockSampleRows = [
    { revenue: 100, units_sold: 5, customer_id: 'C01', email: 'a@b.com' }
  ];

  // 1. Successful Sales KPI recommendation
  it('should successfully recommend and persist valid KPIs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                kpis: [
                  {
                    name: 'Total Revenue',
                    description: 'Total sales revenue generated.',
                    sourceColumns: ['revenue'],
                    aggregation: 'sum',
                    priority: 'primary'
                  },
                  {
                    name: 'Average Units Sold',
                    description: 'Average units sold per order.',
                    sourceColumns: ['units_sold'],
                    aggregation: 'avg',
                    priority: 'secondary'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendKpis('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Total Revenue');
    expect(result[1].name).toBe('Average Units Sold');

    expect(updateKpis).toHaveBeenCalledTimes(1);
    expect(updateKpis).toHaveBeenCalledWith('mock-dataset-id', result);
  });

  // 2. Column Existence Check
  it('should strip KPIs referencing non-existent columns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                kpis: [
                  {
                    name: 'Total Revenue',
                    description: 'Total revenue.',
                    sourceColumns: ['revenue'],
                    aggregation: 'sum',
                    priority: 'primary'
                  },
                  {
                    name: 'Hallucinated Metric',
                    description: 'Uses columns that do not exist.',
                    sourceColumns: ['profit'], // nonexistent column name!
                    aggregation: 'sum',
                    priority: 'primary'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendKpis('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    // Hallucinated metric is stripped, leaving only Total Revenue
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Total Revenue');
    expect(updateKpis).toHaveBeenCalledTimes(1);
  });

  // 3. PII/Identifier Filter Check
  it('should reject KPIs referencing identifier or ignore columns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                kpis: [
                  {
                    name: 'Unique Customers',
                    description: 'Total unique identifier customers.',
                    sourceColumns: ['customer_id'], // forbidden (identifier)
                    aggregation: 'count',
                    priority: 'primary'
                  },
                  {
                    name: 'Total Revenue',
                    description: 'Sum of revenue.',
                    sourceColumns: ['revenue'],
                    aggregation: 'sum',
                    priority: 'primary'
                  },
                  {
                    name: 'Email KPIs',
                    description: 'Aggregating email strings.',
                    sourceColumns: ['email'], // forbidden (ignore)
                    aggregation: 'count',
                    priority: 'secondary'
                  }
                ]
              })
            }]
          }
        }]
      })
    });

    const result = await recommendKpis('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    // Unique Customers and Email KPIs are stripped, leaving only Total Revenue
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Total Revenue');
  });

  // 4. Cap & Priority Sorting
  it('should cap KPIs at 8 elements and sort primary priority before secondary', async () => {
    const kpisList = Array.from({ length: 10 }).map((_, index) => ({
      name: `KPI ${index}`,
      description: `Description ${index}`,
      sourceColumns: ['revenue'],
      aggregation: 'sum',
      priority: index % 2 === 0 ? 'secondary' : 'primary' // alternate primary and secondary
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({ kpis: kpisList })
            }]
          }
        }]
      })
    });

    const result = await recommendKpis('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(8); // Capped at 8
    
    // First 5 should all be primary (indices 1, 3, 5, 7, 9)
    for (let i = 0; i < 5; i++) {
      expect(result[i].priority).toBe('primary');
    }
    // Remaining should be secondary
    for (let i = 5; i < 8; i++) {
      expect(result[i].priority).toBe('secondary');
    }
  });

  // 5. Safe Fallback on AI Failure
  it('should gracefully return an empty array on AI execution failure', async () => {
    // Return fetch error
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

    const result = await recommendKpis('mock-dataset-id', {
      datasetType: 'Sales',
      columnRoles: mockColumnRoles,
      metadata: mockMetadata,
      sampleRows: mockSampleRows
    });

    expect(result).toEqual([]);
    expect(updateKpis).toHaveBeenCalledTimes(1);
    expect(updateKpis).toHaveBeenCalledWith('mock-dataset-id', []);
  });
});
