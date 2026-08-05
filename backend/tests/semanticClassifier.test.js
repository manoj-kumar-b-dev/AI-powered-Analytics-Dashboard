/**
 * Tests for semanticClassifier.js
 *
 * Verifies that the semantic column classifier correctly assigns
 * semantic roles to columns based on name and type signals.
 */

const { classifyColumn, classifyColumns, SEMANTIC_ROLES } = require('../src/analytics/semantic/semanticClassifier');

// Helper to classify by name + type
const classify = (name, type = 'numeric') => classifyColumn({ column: name, name, type, inferredType: type });

describe('SemanticClassifier — Column Role Assignment', () => {

  // ───────────────────────────────────────────────────────
  // Identifier detection
  // ───────────────────────────────────────────────────────
  describe('Identifier Detection', () => {
    test.each([
      ['Employee_ID', 'numeric'],
      ['employee_id', 'numeric'],
      ['EMP_ID', 'numeric'],
      ['customer_id', 'numeric'],
      ['order_id', 'numeric'],
      ['User_ID', 'numeric'],
      ['sku_id', 'numeric'],
      ['ID', 'numeric']
    ])('"%s" (%s) should be classified as IDENTIFIER', (name, type) => {
      const result = classify(name, type);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.IDENTIFIER);
    });
  });

  // ───────────────────────────────────────────────────────
  // Demographic attribute detection
  // ───────────────────────────────────────────────────────
  describe('Demographic Attribute Detection', () => {
    test.each([
      ['Age', 'numeric'],
      ['age', 'numeric'],
      ['Employee_Age', 'numeric'],
      ['Experience_Years', 'numeric'],
      ['Tenure', 'numeric'],
      ['Years_of_Experience', 'numeric']
    ])('"%s" should be classified as DEMOGRAPHIC_ATTRIBUTE', (name) => {
      const result = classify(name);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE);
    });
  });

  // ───────────────────────────────────────────────────────
  // Ordinal / score / rating metric detection
  // ───────────────────────────────────────────────────────
  describe('Ordinal Metric Detection', () => {
    test.each([
      ['Performance_Rating', 'numeric'],
      ['Performance_Score', 'numeric'],
      ['Rating', 'numeric'],
      ['Star_Rating', 'numeric'],
      ['NPS_Score', 'numeric'],
      ['CSAT_Score', 'numeric'],
      ['satisfaction_score', 'numeric'],
      ['grade', 'numeric']
    ])('"%s" should be classified as ORDINAL_METRIC', (name) => {
      const result = classify(name);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.ORDINAL_METRIC);
    });
  });

  // ───────────────────────────────────────────────────────
  // Percentage metric detection
  // ───────────────────────────────────────────────────────
  describe('Percentage Metric Detection', () => {
    test.each([
      ['Attendance_Percent', 'numeric'],
      ['Attendance_Pct', 'numeric'],
      ['attendance_rate', 'numeric'],
      ['conversion_rate', 'numeric'],
      ['churn_rate', 'numeric'],
      ['Margin_Pct', 'percentage'],
      ['fill_rate', 'numeric'],
      ['utilization', 'numeric']
    ])('"%s" should be classified as PERCENTAGE_METRIC', (name, type) => {
      const result = classify(name, type);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.PERCENTAGE_METRIC);
    });
  });

  // ───────────────────────────────────────────────────────
  // Monetary metric detection
  // ───────────────────────────────────────────────────────
  describe('Monetary Metric Detection', () => {
    test.each([
      ['Monthly_Salary', 'currency'],
      ['salary', 'numeric'],
      ['Revenue', 'numeric'],
      ['Total_Revenue', 'numeric'],
      ['Profit', 'numeric'],
      ['Cost', 'numeric'],
      ['Expenses', 'numeric'],
      ['Budget', 'numeric'],
      ['Sale_Amount', 'numeric'],
      ['Price', 'numeric'],
      ['Amount', 'numeric']
    ])('"%s" should be classified as MONETARY_METRIC', (name, type) => {
      const result = classify(name, type);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.MONETARY_METRIC);
    });
  });

  // ───────────────────────────────────────────────────────
  // Temporal dimension detection
  // ───────────────────────────────────────────────────────
  describe('Temporal Dimension Detection', () => {
    test.each([
      ['Joining_Date', 'date'],
      ['hire_date', 'date'],
      ['created_at', 'date'],
      ['order_date', 'date'],
      ['Date', 'date'],
      ['Month', 'date'],
      ['resignation_date', 'date']
    ])('"%s" should be classified as TEMPORAL_DIMENSION', (name, type) => {
      const result = classify(name, type);
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.TEMPORAL_DIMENSION);
    });
  });

  // ───────────────────────────────────────────────────────
  // Categorical dimension detection
  // ───────────────────────────────────────────────────────
  describe('Categorical Dimension Detection', () => {
    test.each([
      ['Department', 'categorical'],
      ['Job_Title', 'categorical'],
      ['Gender', 'categorical'],
      ['Category', 'categorical'],
      ['Region', 'text'],  // low cardinality
      ['Product_Type', 'categorical']
    ])('"%s" should be classified as CATEGORICAL_DIMENSION', (name, type) => {
      const col = { column: name, name, type, inferredType: type, uniqueValueCount: 5 };
      const result = classifyColumn(col, []);
      expect([SEMANTIC_ROLES.CATEGORICAL_DIMENSION, SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION, SEMANTIC_ROLES.STATUS_DIMENSION]).toContain(result.semanticRole);
    });
  });

  // ───────────────────────────────────────────────────────
  // Contact / sensitive data detection
  // ───────────────────────────────────────────────────────
  describe('Contact / Sensitive Data Detection', () => {
    test('Email should be classified as CONTACT_INFORMATION', () => {
      const result = classify('Email', 'text');
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.CONTACT_INFORMATION);
    });

    test('Phone_Number should be classified as CONTACT_INFORMATION', () => {
      const result = classify('Phone_Number', 'text');
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.CONTACT_INFORMATION);
    });

    test('First_Name should be classified as SENSITIVE_ATTRIBUTE', () => {
      const result = classify('First_Name', 'text');
      expect(result.semanticRole).toBe(SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE);
    });
  });

  // ───────────────────────────────────────────────────────
  // classifyColumns (batch)
  // ───────────────────────────────────────────────────────
  describe('Batch classifyColumns', () => {
    test('HR schema is correctly classified in batch', () => {
      const schema = [
        { column: 'Employee_ID', type: 'numeric' },
        { column: 'First_Name', type: 'text' },
        { column: 'Department', type: 'categorical', uniqueValueCount: 8 },
        { column: 'Age', type: 'numeric' },
        { column: 'Monthly_Salary', type: 'currency' },
        { column: 'Performance_Rating', type: 'numeric' },
        { column: 'Joining_Date', type: 'date' },
        { column: 'Attendance_Percent', type: 'percentage' },
        { column: 'Status', type: 'categorical', uniqueValueCount: 3 }
      ];

      const result = classifyColumns(schema);

      expect(result.get('Employee_ID').semanticRole).toBe(SEMANTIC_ROLES.IDENTIFIER);
      expect(result.get('First_Name').semanticRole).toBe(SEMANTIC_ROLES.SENSITIVE_ATTRIBUTE);
      expect(result.get('Age').semanticRole).toBe(SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE);
      expect(result.get('Monthly_Salary').semanticRole).toBe(SEMANTIC_ROLES.MONETARY_METRIC);
      expect(result.get('Performance_Rating').semanticRole).toBe(SEMANTIC_ROLES.ORDINAL_METRIC);
      expect(result.get('Joining_Date').semanticRole).toBe(SEMANTIC_ROLES.TEMPORAL_DIMENSION);
      expect(result.get('Attendance_Percent').semanticRole).toBe(SEMANTIC_ROLES.PERCENTAGE_METRIC);
    });
  });
});
