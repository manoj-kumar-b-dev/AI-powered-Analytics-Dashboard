const { classifyDataset } = require('../../src/services/ai/datasetClassifier');
const { updateClassification } = require('../../src/repositories/datasetRepository');

// Mock the repository to avoid MongoDB connection requirements during unit tests
jest.mock('../../src/repositories/datasetRepository', () => ({
  updateClassification: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('Dataset Classifier Service', () => {
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
    rowCount: 100,
    columns: [
      { name: 'order_id', inferredType: 'text', uniqueValueCount: 100 },
      { name: 'revenue', inferredType: 'currency', uniqueValueCount: 95 },
      { name: 'region', inferredType: 'text', uniqueValueCount: 4 },
      { name: 'date', inferredType: 'date', uniqueValueCount: 50 }
    ]
  };

  const mockColumnClassifications = [
    { columnName: 'order_id', detectedType: 'identifier', businessRole: 'identifier' },
    { columnName: 'revenue', detectedType: 'currency', businessRole: 'metric' },
    { columnName: 'region', detectedType: 'category', businessRole: 'dimension' },
    { columnName: 'date', detectedType: 'date', businessRole: 'dimension' }
  ];

  const mockSampleRows = [
    { order_id: 'TRX001', revenue: '$150.00', region: 'North', date: '2023-01-01' },
    { order_id: 'TRX002', revenue: '$200.00', region: 'South', date: '2023-01-02' }
  ];

  // 1. Success validation
  it('should correctly classify a Sales-shaped dataset as Sales with high confidence', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"datasetType": "Sales", "confidence": 0.85, "reason": "Contains order identifiers, transaction dates, and revenue values."}'
            }]
          }
        }]
      })
    });

    const result = await classifyDataset('mock-dataset-id', {
      metadata: mockMetadata,
      columnClassifications: mockColumnClassifications,
      sampleRows: mockSampleRows
    });

    expect(result.datasetType).toBe('Sales');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.reason).toContain('order identifiers');

    // Verify database update is triggered with correct fields
    expect(updateClassification).toHaveBeenCalledTimes(1);
    expect(updateClassification).toHaveBeenCalledWith('mock-dataset-id', {
      datasetType: 'Sales',
      confidence: 0.85,
      reason: 'Contains order identifiers, transaction dates, and revenue values.'
    });
  });

  // 2. Coercion to Custom
  it('should coerce outlier types not in the closed set to Custom and reduce confidence', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"datasetType": "RealEstate", "confidence": 0.9, "reason": "Relates to properties and rents."}'
            }]
          }
        }]
      })
    });

    const result = await classifyDataset('mock-dataset-id', {
      metadata: mockMetadata,
      columnClassifications: mockColumnClassifications,
      sampleRows: mockSampleRows
    });

    expect(result.datasetType).toBe('Custom');
    expect(result.confidence).toBe(0.7); // 0.9 - 0.2
    expect(result.reason).toContain('Coerced to Custom');

    expect(updateClassification).toHaveBeenCalledTimes(1);
  });

  // 3. Fallback logic: Unclassified
  it('should store Unclassified with confidence 0 when the AI call fails after retries', async () => {
    // Return malformed outputs to force retry failures
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'not JSON text'
            }]
          }
        }]
      })
    });

    const result = await classifyDataset('mock-dataset-id', {
      metadata: mockMetadata,
      columnClassifications: mockColumnClassifications,
      sampleRows: mockSampleRows
    });

    expect(result.datasetType).toBe('Unclassified');
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain('AI classification failed after retries');

    expect(updateClassification).toHaveBeenCalledTimes(1);
    expect(updateClassification).toHaveBeenCalledWith('mock-dataset-id', {
      datasetType: 'Unclassified',
      confidence: 0,
      reason: expect.stringContaining('AI classification failed after retries')
    });
  });
});
