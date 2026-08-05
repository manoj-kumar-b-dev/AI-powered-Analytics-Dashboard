/**
 * Tests for aggregationRules.js
 *
 * Verifies that the aggregation compatibility engine correctly:
 * - REJECTS invalid aggregations (e.g., SUM(Age), SUM(Rating))
 * - ACCEPTS valid aggregations (e.g., AVG(Age), SUM(Salary))
 * - Returns correct suggestions when rejecting
 */

const {
  validateAggregation,
  getPreferredAggregation,
  isExcludedFromKPI,
  isExcludedFromAnalytics,
  normalizeAggregation,
  AGGREGATIONS
} = require('../src/analytics/aggregation/aggregationRules');
const { SEMANTIC_ROLES } = require('../src/analytics/semantic/semanticClassifier');

describe('AggregationRules — Validation Engine', () => {

  // ───────────────────────────────────────────────────────
  // DEMOGRAPHIC_ATTRIBUTE (Age, Tenure, etc.)
  // ───────────────────────────────────────────────────────
  describe('DEMOGRAPHIC_ATTRIBUTE aggregation rules', () => {
    test('SUM(Age) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE, 'sum');
      expect(result.valid).toBe(false);
      expect(result.suggestedAggregation).toBeTruthy();
    });

    test('AVG(Age) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE, 'avg');
      expect(result.valid).toBe(true);
    });

    test('MEDIAN(Age) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE, 'median');
      expect(result.valid).toBe(true);
    });

    test('COUNT(Age) should NOT be preferred but allowed via distribution', () => {
      // Distribution is allowed for demographics
      const result = validateAggregation(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE, 'distribution');
      expect(result.valid).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────
  // ORDINAL_METRIC (Ratings, Scores, Performance)
  // ───────────────────────────────────────────────────────
  describe('ORDINAL_METRIC aggregation rules', () => {
    test('SUM(Performance_Rating) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.ORDINAL_METRIC, 'sum');
      expect(result.valid).toBe(false);
    });

    test('SUM(Star_Rating) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.ORDINAL_METRIC, 'sum');
      expect(result.valid).toBe(false);
    });

    test('AVG(Performance_Rating) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.ORDINAL_METRIC, 'avg');
      expect(result.valid).toBe(true);
    });

    test('DISTRIBUTION(Rating) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.ORDINAL_METRIC, 'distribution');
      expect(result.valid).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────
  // PERCENTAGE_METRIC (Attendance%, Rate, etc.)
  // ───────────────────────────────────────────────────────
  describe('PERCENTAGE_METRIC aggregation rules', () => {
    test('SUM(Attendance_Percent) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.PERCENTAGE_METRIC, 'sum');
      expect(result.valid).toBe(false);
      expect(result.suggestedAggregation).toBe(AGGREGATIONS.AVG);
    });

    test('SUM(Conversion_Rate) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.PERCENTAGE_METRIC, 'sum');
      expect(result.valid).toBe(false);
    });

    test('AVG(Attendance_Percent) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.PERCENTAGE_METRIC, 'avg');
      expect(result.valid).toBe(true);
    });

    test('Default aggregation for PERCENTAGE_METRIC should be AVG', () => {
      expect(getPreferredAggregation(SEMANTIC_ROLES.PERCENTAGE_METRIC)).toBe(AGGREGATIONS.AVG);
    });
  });

  // ───────────────────────────────────────────────────────
  // MONETARY_METRIC (Salary, Revenue, Cost, etc.)
  // ───────────────────────────────────────────────────────
  describe('MONETARY_METRIC aggregation rules', () => {
    test('SUM(Monthly_Salary) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.MONETARY_METRIC, 'sum');
      expect(result.valid).toBe(true);
    });

    test('AVG(Monthly_Salary) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.MONETARY_METRIC, 'avg');
      expect(result.valid).toBe(true);
    });

    test('SUM(Revenue) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.MONETARY_METRIC, 'sum');
      expect(result.valid).toBe(true);
    });

    test('Default aggregation for MONETARY_METRIC should be SUM', () => {
      expect(getPreferredAggregation(SEMANTIC_ROLES.MONETARY_METRIC)).toBe(AGGREGATIONS.SUM);
    });
  });

  // ───────────────────────────────────────────────────────
  // IDENTIFIER (Employee_ID, Order_ID, etc.)
  // ───────────────────────────────────────────────────────
  describe('IDENTIFIER aggregation rules', () => {
    test('SUM(Employee_ID) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.IDENTIFIER, 'sum');
      expect(result.valid).toBe(false);
    });

    test('AVG(Employee_ID) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.IDENTIFIER, 'avg');
      expect(result.valid).toBe(false);
    });

    test('COUNT_DISTINCT(Employee_ID) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.IDENTIFIER, 'count_distinct');
      expect(result.valid).toBe(true);
    });

    test('COUNT(Order_ID) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.IDENTIFIER, 'count');
      expect(result.valid).toBe(true);
    });

    test('Default aggregation for IDENTIFIER should be COUNT_DISTINCT', () => {
      expect(getPreferredAggregation(SEMANTIC_ROLES.IDENTIFIER)).toBe(AGGREGATIONS.COUNT_DISTINCT);
    });
  });

  // ───────────────────────────────────────────────────────
  // CATEGORICAL_DIMENSION (Department, Status, etc.)
  // ───────────────────────────────────────────────────────
  describe('CATEGORICAL_DIMENSION aggregation rules', () => {
    test('SUM(Department) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.CATEGORICAL_DIMENSION, 'sum');
      expect(result.valid).toBe(false);
    });

    test('AVG(Department) should be REJECTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.CATEGORICAL_DIMENSION, 'avg');
      expect(result.valid).toBe(false);
    });

    test('GROUP_BY(Department) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.CATEGORICAL_DIMENSION, 'group_by');
      expect(result.valid).toBe(true);
    });

    test('COUNT(Department) should be ACCEPTED', () => {
      const result = validateAggregation(SEMANTIC_ROLES.CATEGORICAL_DIMENSION, 'count');
      expect(result.valid).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────
  // Exclusion checks
  // ───────────────────────────────────────────────────────
  describe('Exclusion from KPI and Analytics', () => {
    test('IDENTIFIER should be excluded from standard KPI analysis', () => {
      expect(isExcludedFromKPI(SEMANTIC_ROLES.IDENTIFIER)).toBe(true);
    });

    test('CATEGORICAL_DIMENSION should be excluded from standard KPI analysis', () => {
      expect(isExcludedFromKPI(SEMANTIC_ROLES.CATEGORICAL_DIMENSION)).toBe(true);
    });

    test('MONETARY_METRIC should NOT be excluded from KPI analysis', () => {
      expect(isExcludedFromKPI(SEMANTIC_ROLES.MONETARY_METRIC)).toBe(false);
    });

    test('CONTACT_INFORMATION should be excluded from analytics entirely', () => {
      expect(isExcludedFromAnalytics(SEMANTIC_ROLES.CONTACT_INFORMATION)).toBe(true);
    });

    test('SENSITIVE_ATTRIBUTE should be excluded from analytics entirely', () => {
      expect(isExcludedFromAnalytics(SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE)).toBe(true);
    });

    test('MONETARY_METRIC should NOT be excluded from analytics', () => {
      expect(isExcludedFromAnalytics(SEMANTIC_ROLES.MONETARY_METRIC)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────
  // Aggregation normalization
  // ───────────────────────────────────────────────────────
  describe('Aggregation normalization', () => {
    test('"distinct" normalizes to "count_distinct"', () => {
      expect(normalizeAggregation('distinct')).toBe('count_distinct');
    });

    test('"average" normalizes to "avg"', () => {
      expect(normalizeAggregation('average')).toBe('avg');
    });

    test('"total" normalizes to "sum"', () => {
      expect(normalizeAggregation('total')).toBe('sum');
    });

    test('"mean" normalizes to "avg"', () => {
      expect(normalizeAggregation('mean')).toBe('avg');
    });

    test('"count" stays "count"', () => {
      expect(normalizeAggregation('count')).toBe('count');
    });
  });
});
