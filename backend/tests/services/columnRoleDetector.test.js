const { detectColumnRoles } = require('../../src/services/ai/columnRoleDetector');
const { updateColumnRoles } = require('../../src/repositories/datasetRepository');

// Mock the repository to avoid MongoDB connection requirements during unit tests
jest.mock('../../src/repositories/datasetRepository', () => ({
  updateColumnRoles: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));

describe('Column Role Detector Service', () => {
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
      { name: 'order_id', inferredType: 'text', uniqueValueCount: 10 },
      { name: 'revenue', inferredType: 'currency', uniqueValueCount: 10 },
      { name: 'score', inferredType: 'numeric', uniqueValueCount: 5 }
    ]
  };

  const mockSampleRows = [
    { order_id: '123', revenue: 100, score: 8 },
    { order_id: '124', revenue: 200, score: 9 }
  ];

  // 1. Rule Match Only
  it('should skip AI call entirely and use rule-based roles when all columns are high-confidence', async () => {
    const mockBaseline = [
      { columnName: 'order_id', detectedType: 'identifier', businessRole: 'identifier', confidence: 0.95 },
      { columnName: 'revenue', detectedType: 'currency', businessRole: 'metric', confidence: 0.90 }
    ];

    const result = await detectColumnRoles('mock-dataset-id', {
      datasetType: 'Sales',
      metadata: mockMetadata,
      ruleBaseline: mockBaseline,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('rule');
    expect(result[1].source).toBe('rule');
    expect(mockFetch).not.toHaveBeenCalled(); // Safe cost optimization

    expect(updateColumnRoles).toHaveBeenCalledTimes(1);
    expect(updateColumnRoles).toHaveBeenCalledWith('mock-dataset-id', [
      { columnName: 'order_id', detectedType: 'identifier', businessRole: 'identifier', confidence: 0.95, reason: 'Classified via high confidence rules', source: 'rule' },
      { columnName: 'revenue', detectedType: 'currency', businessRole: 'metric', confidence: 0.90, reason: 'Classified via high confidence rules', source: 'rule' }
    ]);
  });

  // 2. Hybrid Resolution (Rule + AI)
  it('should call Gemini only for ambiguous columns and merge the output', async () => {
    const mockBaseline = [
      { columnName: 'order_id', detectedType: 'identifier', businessRole: 'identifier', confidence: 0.95 },
      { columnName: 'score', detectedType: 'numeric', businessRole: 'metric', confidence: 0.55, needsReview: true } // ambiguous!
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '[{"columnName": "score", "businessRole": "Secondary KPI", "confidence": 0.85, "reason": "Values indicate score ranges."}]'
            }]
          }
        }]
      })
    });

    const result = await detectColumnRoles('mock-dataset-id', {
      datasetType: 'Sales',
      metadata: mockMetadata,
      ruleBaseline: mockBaseline,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(2);
    
    const orderIdCol = result.find(c => c.columnName === 'order_id');
    expect(orderIdCol.source).toBe('rule');
    expect(orderIdCol.businessRole).toBe('identifier');

    const scoreCol = result.find(c => c.columnName === 'score');
    expect(scoreCol.source).toBe('ai');
    expect(scoreCol.businessRole).toBe('Secondary KPI');
    expect(scoreCol.confidence).toBe(0.85);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(updateColumnRoles).toHaveBeenCalledTimes(1);
  });

  // 3. Fallback on AI Failure
  it('should fall back to Rule Engine baseline when AI classification fails', async () => {
    const mockBaseline = [
      { columnName: 'score', detectedType: 'numeric', businessRole: 'metric', confidence: 0.55, needsReview: true, reason: 'Low unique values' }
    ];

    // Force LLM fetch failure
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'invalid payload'
            }]
          }
        }]
      })
    });

    const result = await detectColumnRoles('mock-dataset-id', {
      datasetType: 'Sales',
      metadata: mockMetadata,
      ruleBaseline: mockBaseline,
      sampleRows: mockSampleRows
    });

    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe('score');
    expect(result[0].businessRole).toBe('metric'); // falls back to baseline guess
    expect(result[0].source).toBe('rule'); // fallback is labeled as rule
    expect(result[0].reason).toContain('Fallback to rule engine. AI refinement failed');

    expect(updateColumnRoles).toHaveBeenCalledTimes(1);
  });
});
