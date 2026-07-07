const { extractMetadata } = require('../../src/services/metadata/extractMetadata');

describe('Metadata Extraction Service', () => {
  // 1. Empty Dataset
  it('should handle an empty dataset', () => {
    const meta = extractMetadata([], ['col1', 'col2']);
    expect(meta.rowCount).toBe(0);
    expect(meta.columnCount).toBe(2);
    expect(meta.duplicateRowCount).toBe(0);
    expect(meta.duplicateColumnNames).toEqual([]);
    expect(meta.sampleRows).toEqual([]);
    expect(meta.columns).toHaveLength(2);
    expect(meta.columns[0]).toEqual({
      name: 'col1',
      inferredType: 'text',
      isNumeric: false,
      isDate: false,
      isBoolean: false,
      isCurrencyLike: false,
      isPercentageLike: false,
      isText: true,
      uniqueValueCount: 0,
      missingValueCount: 0,
      missingValuePercent: 0
    });
  });

  // 2. All-Null Column
  it('should handle all-null column and fallback to text', () => {
    const rows = [
      { col1: null, col2: 'val' },
      { col1: undefined, col2: 'val' },
      { col1: '', col2: 'val' }
    ];
    const meta = extractMetadata(rows, ['col1', 'col2']);
    expect(meta.rowCount).toBe(3);
    expect(meta.columns[0]).toEqual({
      name: 'col1',
      inferredType: 'text',
      isNumeric: false,
      isDate: false,
      isBoolean: false,
      isCurrencyLike: false,
      isPercentageLike: false,
      isText: true,
      uniqueValueCount: 0,
      missingValueCount: 3,
      missingValuePercent: 100
    });
  });

  // 3. Mixed Date Formats
  it('should detect dates with mixed formats above >90% threshold', () => {
    const rows = [
      { dateCol: '2023-01-01' },
      { dateCol: '02/15/2023' },
      { dateCol: '31-12-2023' },
      { dateCol: new Date('2023-06-15') },
      { dateCol: '2023.08.20' },
      { dateCol: '2023/11/05' },
      { dateCol: '12-25-2023' },
      { dateCol: '01/01/2024' },
      { dateCol: '2024-02-29' },
      { dateCol: '10 May 2024' },
      { dateCol: 'not-a-date' } // 10 valid, 1 invalid -> 10/11 = 90.9% (>90%)
    ];
    const meta = extractMetadata(rows, ['dateCol']);
    expect(meta.columns[0].inferredType).toBe('date');
    expect(meta.columns[0].isDate).toBe(true);
    expect(meta.columns[0].isText).toBe(false);
  });

  it('should fallback to text if date formats fall below/equal to 90% threshold', () => {
    const rows = [
      { dateCol: '2023-01-01' },
      { dateCol: '02/15/2023' },
      { dateCol: '31-12-2023' },
      { dateCol: new Date('2023-06-15') },
      { dateCol: '2023.08.20' },
      { dateCol: '2023/11/05' },
      { dateCol: '12-25-2023' },
      { dateCol: '01/01/2024' },
      { dateCol: '2024-02-29' },
      { dateCol: 'invalid-1' },
      { dateCol: 'invalid-2' } // 9 valid, 2 invalid -> 9/11 = 81.8% (<=90%)
    ];
    const meta = extractMetadata(rows, ['dateCol']);
    expect(meta.columns[0].inferredType).toBe('text');
    expect(meta.columns[0].isDate).toBe(false);
    expect(meta.columns[0].isText).toBe(true);
  });

  // 4. Boolean Detection with "Yes"/"No" and other boolean representations
  it('should detect booleans with Yes/No text, true/false, and 0/1 values', () => {
    const rows = [
      { boolCol: 'Yes' },
      { boolCol: 'No' },
      { boolCol: 'yes' },
      { boolCol: 'NO' },
      { boolCol: true },
      { boolCol: false },
      { boolCol: 'true' },
      { boolCol: 'false' },
      { boolCol: 1 },
      { boolCol: 0 },
      { boolCol: null } // should ignore nulls when calculating boolean constraint
    ];
    const meta = extractMetadata(rows, ['boolCol']);
    expect(meta.columns[0].inferredType).toBe('boolean');
    expect(meta.columns[0].isBoolean).toBe(true);
  });

  it('should not detect boolean if invalid boolean values are present', () => {
    const rows = [
      { boolCol: 'Yes' },
      { boolCol: 'No' },
      { boolCol: 'Maybe' } // Not in the allowed set
    ];
    const meta = extractMetadata(rows, ['boolCol']);
    expect(meta.columns[0].inferredType).toBe('text');
    expect(meta.columns[0].isBoolean).toBe(false);
  });

  // 5. Currency-Like Detection
  it('should detect currency columns by name (regex match)', () => {
    const rows = [
      { price: 100 },
      { price: 200 },
      { price: null },
      { price: 300 }
    ];
    const meta = extractMetadata(rows, ['price']);
    expect(meta.columns[0].inferredType).toBe('currency');
    expect(meta.columns[0].isCurrencyLike).toBe(true);
  });

  it('should detect currency columns by currency symbols', () => {
    const rows = [
      { myCol: '$100.50' },
      { myCol: '€200' },
      { myCol: '£300.99' },
      { myCol: '¥4,000' }
    ];
    const meta = extractMetadata(rows, ['myCol']);
    expect(meta.columns[0].inferredType).toBe('currency');
    expect(meta.columns[0].isCurrencyLike).toBe(true);
  });

  // 6. Percentage-Like Detection
  it('should detect percentage columns by name and values in 0-100 range', () => {
    const rows = [
      { conversion_rate: 0.5 },
      { conversion_rate: 75.3 },
      { conversion_rate: 100 }
    ];
    const meta = extractMetadata(rows, ['conversion_rate']);
    expect(meta.columns[0].inferredType).toBe('percentage');
    expect(meta.columns[0].isPercentageLike).toBe(true);
  });

  it('should not detect percentage by name if values fall outside 0-100 range', () => {
    const rows = [
      { conversion_rate: 105 }, // outside 0-100
      { conversion_rate: 50 },
      { conversion_rate: -5 } // outside 0-100
    ];
    const meta = extractMetadata(rows, ['conversion_rate']);
    expect(meta.columns[0].inferredType).toBe('numeric');
    expect(meta.columns[0].isPercentageLike).toBe(false);
  });

  it('should detect percentage columns by suffix %', () => {
    const rows = [
      { myCol: '50%' },
      { myCol: '12.5 %' },
      { myCol: '100%' }
    ];
    const meta = extractMetadata(rows, ['myCol']);
    expect(meta.columns[0].inferredType).toBe('percentage');
    expect(meta.columns[0].isPercentageLike).toBe(true);
  });

  // 7. Numeric Detection
  it('should detect generic numeric columns without matching currency/percentage rules', () => {
    const rows = [
      { numCol: '1,234' },
      { numCol: 56.78 },
      { numCol: -12 }
    ];
    const meta = extractMetadata(rows, ['numCol']);
    expect(meta.columns[0].inferredType).toBe('numeric');
    expect(meta.columns[0].isNumeric).toBe(true);
  });

  // 8. Duplicate Row Count
  it('should count duplicate rows accurately', () => {
    const rows = [
      { a: 1, b: 2 },
      { a: 1, b: 2 }, // duplicate
      { a: 2, b: 3 },
      { a: 1, b: 2 }, // duplicate
      { a: 3, b: 4 }
    ];
    const meta = extractMetadata(rows, ['a', 'b']);
    expect(meta.duplicateRowCount).toBe(2);
  });

  // 9. Duplicate Columns Detection
  it('should identify columns with identical values across all rows', () => {
    const rows = [
      { colA: 'foo', colB: 'foo', colC: 'bar' },
      { colA: 'baz', colB: 'baz', colC: 'qux' }
    ];
    const meta = extractMetadata(rows, ['colA', 'colB', 'colC']);
    expect(meta.duplicateColumnNames).toEqual(['colB']);
  });

  // 10. Sample Rows
  it('should return the first 5 rows unmodified as samples', () => {
    const rows = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 6 }
    ];
    const meta = extractMetadata(rows, ['id']);
    expect(meta.sampleRows).toHaveLength(5);
    expect(meta.sampleRows).toEqual(rows.slice(0, 5));
    // Verify it is not modified
    expect(meta.sampleRows[0]).toBe(rows[0]);
  });
});
