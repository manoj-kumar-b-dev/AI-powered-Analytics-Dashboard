const { buildTemporalPipeline, selectGranularity, formatTemporalLabel } = require('../src/analytics/execution/temporalAggregationExecutor');

describe('temporalAggregationExecutor', () => {
  describe('selectGranularity', () => {
    test('selects day for ranges <= 31 days', () => {
      const min = new Date('2025-01-01');
      const max = new Date('2025-01-20');
      expect(selectGranularity(min, max)).toBe('day');
    });

    test('selects week for ranges between 32 and 180 days', () => {
      const min = new Date('2025-01-01');
      const max = new Date('2025-04-01');
      expect(selectGranularity(min, max)).toBe('week');
    });

    test('selects month for ranges between 181 and 730 days (~1.5 years dataset)', () => {
      const min = new Date('2025-01-03');
      const max = new Date('2026-06-27');
      expect(selectGranularity(min, max)).toBe('month');
    });

    test('selects quarter for ranges between 731 and 2000 days', () => {
      const min = new Date('2020-01-01');
      const max = new Date('2023-01-01');
      expect(selectGranularity(min, max)).toBe('quarter');
    });

    test('defaults to month when dates are missing or invalid', () => {
      expect(selectGranularity(null, null)).toBe('month');
      expect(selectGranularity(new Date('invalid'), new Date('2025-01-01'))).toBe('month');
    });
  });

  describe('buildTemporalPipeline', () => {
    test('generates valid pipeline with $convert and $dateToString for month granularity', () => {
      const min = new Date('2025-01-03');
      const max = new Date('2026-06-27');
      const { pipeline, granularity } = buildTemporalPipeline('Order Date', 'Revenue', 'sum', min, max);

      expect(granularity).toBe('month');
      expect(pipeline.length).toBe(5);

      // Group stage check
      const groupStage = pipeline.find(s => s.$group);
      expect(groupStage).toBeDefined();
      expect(groupStage.$group._id).toEqual({
        $dateToString: {
          format: '%Y-%m',
          date: {
            $convert: {
              input: '$data.Order Date',
              to: 'date',
              onError: null,
              onNull: null
            }
          }
        }
      });
      expect(groupStage.$group.yVal).toEqual({ $sum: '$data.Revenue' });
    });

    test('excludes null _id buckets after group', () => {
      const min = new Date('2025-01-03');
      const max = new Date('2026-06-27');
      const { pipeline } = buildTemporalPipeline('order_date', 'revenue', 'sum', min, max);

      const nullMatchStage = pipeline.find(s => s.$match && s.$match._id);
      expect(nullMatchStage).toBeDefined();
      expect(nullMatchStage.$match._id).toEqual({ $ne: null });
    });
  });

  describe('formatTemporalLabel', () => {
    test('formats strings and Date objects correctly', () => {
      expect(formatTemporalLabel('2025-01', 'month')).toBe('2025-01');
      expect(formatTemporalLabel(new Date('2025-01-15T00:00:00Z'), 'day')).toBe('2025-01-15');
      expect(formatTemporalLabel(null, 'month')).toBe('(unknown)');
    });
  });
});
