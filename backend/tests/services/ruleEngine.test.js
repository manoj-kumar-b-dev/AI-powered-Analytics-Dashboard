const { classifyColumns } = require('../../src/services/ruleEngine/classifyColumns');

describe('Rule Engine Service', () => {
  // 1. Acceptance Criteria: order_id, email, signup_date, revenue
  it('should correctly classify order_id, email, signup_date, and revenue with >0.8 confidence', () => {
    const mockMetadata = {
      rowCount: 5,
      sampleRows: [
        { order_id: '123', email: 'alice@test.com', signup_date: '2023-01-01', revenue: 100.5 },
        { order_id: '124', email: 'bob@test.com', signup_date: '2023-01-02', revenue: 200.0 },
        { order_id: '125', email: 'charlie@test.com', signup_date: '2023-01-03', revenue: 150.75 },
        { order_id: '126', email: 'david@test.com', signup_date: '2023-01-04', revenue: 300.2 },
        { order_id: '127', email: 'eva@test.com', signup_date: '2023-01-05', revenue: 250.0 }
      ],
      columns: [
        { name: 'order_id', inferredType: 'text', uniqueValueCount: 5 },
        { name: 'email', inferredType: 'text', uniqueValueCount: 5 },
        { name: 'signup_date', inferredType: 'date', uniqueValueCount: 5 },
        { name: 'revenue', inferredType: 'currency', uniqueValueCount: 5 }
      ]
    };

    const result = classifyColumns(mockMetadata);
    expect(result).toHaveLength(4);

    // order_id -> identifier
    const orderIdCol = result.find(c => c.columnName === 'order_id');
    expect(orderIdCol.businessRole).toBe('identifier');
    expect(orderIdCol.detectedType).toBe('identifier');
    expect(orderIdCol.confidence).toBeGreaterThan(0.8);
    expect(orderIdCol.needsReview).toBe(false);

    // email -> ignore
    const emailCol = result.find(c => c.columnName === 'email');
    expect(emailCol.businessRole).toBe('ignore');
    expect(emailCol.detectedType).toBe('text');
    expect(emailCol.confidence).toBeGreaterThan(0.8);
    expect(emailCol.needsReview).toBe(false);

    // signup_date -> dimension
    const signupCol = result.find(c => c.columnName === 'signup_date');
    expect(signupCol.businessRole).toBe('dimension');
    expect(signupCol.detectedType).toBe('date');
    expect(signupCol.confidence).toBeGreaterThan(0.8);
    expect(signupCol.needsReview).toBe(false);

    // revenue -> metric
    const revCol = result.find(c => c.columnName === 'revenue');
    expect(revCol.businessRole).toBe('metric');
    expect(revCol.detectedType).toBe('currency');
    expect(revCol.confidence).toBeGreaterThan(0.8);
    expect(revCol.needsReview).toBe(false);
  });

  // 2. Acceptance Criteria: Ambiguous case (numeric "score" with 10 unique values)
  it('should handle ambiguous numeric column "score" with low unique values', () => {
    const mockMetadata = {
      rowCount: 100,
      sampleRows: [
        { score: 5 },
        { score: 3 },
        { score: 10 },
        { score: 1 },
        { score: 8 }
      ],
      columns: [
        { name: 'score', inferredType: 'numeric', uniqueValueCount: 10 }
      ]
    };

    const result = classifyColumns(mockMetadata);
    const scoreCol = result[0];
    expect(scoreCol.columnName).toBe('score');
    expect(scoreCol.businessRole).toBe('metric');
    expect(scoreCol.detectedType).toBe('numeric');
    // should have low confidence (< 0.6) and flag needsReview
    expect(scoreCol.confidence).toBeLessThan(0.6);
    expect(scoreCol.needsReview).toBe(true);
  });

  // 3. Ignore Rules: Phone numbers, URLs, and locations
  it('should classify phone, urls, and addresses as ignore', () => {
    const mockMetadata = {
      rowCount: 5,
      sampleRows: [
        { phone: '+1-555-0199', website: 'https://site.org', city: 'Denver' },
        { phone: '555-0120', website: 'http://my-blog.com', city: 'Austin' },
        { phone: '(555) 0134', website: 'blog.io', city: 'Boston' },
        { phone: '+44 20 7946 0958', website: 'sub.domain.edu', city: 'Seattle' },
        { phone: '555-0145', website: 'http://test.com/path', city: 'Chicago' }
      ],
      columns: [
        { name: 'phone', inferredType: 'text', uniqueValueCount: 5 },
        { name: 'website', inferredType: 'text', uniqueValueCount: 5 },
        { name: 'city', inferredType: 'text', uniqueValueCount: 5 }
      ]
    };

    const result = classifyColumns(mockMetadata);

    const phoneCol = result.find(c => c.columnName === 'phone');
    expect(phoneCol.businessRole).toBe('ignore');
    expect(phoneCol.detectedType).toBe('text');
    expect(phoneCol.confidence).toBeGreaterThan(0.8);

    const webCol = result.find(c => c.columnName === 'website');
    expect(webCol.businessRole).toBe('ignore');
    expect(webCol.detectedType).toBe('text');
    expect(webCol.confidence).toBeGreaterThan(0.8);

    const cityCol = result.find(c => c.columnName === 'city');
    expect(cityCol.businessRole).toBe('ignore');
    expect(cityCol.detectedType).toBe('text');
    expect(cityCol.confidence).toBeGreaterThan(0.8);
  });

  // 4. Categories vs Fallback Text (cardinality check)
  it('should classify text columns with low cardinality as category dimensions', () => {
    const mockMetadata = {
      rowCount: 100,
      sampleRows: Array(5).fill({ status: 'Active' }),
      columns: [
        { name: 'status', inferredType: 'text', uniqueValueCount: 3 }
      ]
    };

    const result = classifyColumns(mockMetadata);
    const statusCol = result[0];
    expect(statusCol.detectedType).toBe('category');
    expect(statusCol.businessRole).toBe('dimension');
    expect(statusCol.confidence).toBe(0.85);
    expect(statusCol.needsReview).toBe(false);
  });

  it('should classify text columns with high cardinality as ignore fallback and flag needsReview', () => {
    const mockMetadata = {
      rowCount: 100,
      sampleRows: Array(5).fill({ comments: 'Very interesting data' }),
      columns: [
        { name: 'comments', inferredType: 'text', uniqueValueCount: 95 }
      ]
    };

    const result = classifyColumns(mockMetadata);
    const commentsCol = result[0];
    expect(commentsCol.detectedType).toBe('text');
    expect(commentsCol.businessRole).toBe('ignore');
    expect(commentsCol.confidence).toBeLessThan(0.6);
    expect(commentsCol.needsReview).toBe(true);
  });
});
