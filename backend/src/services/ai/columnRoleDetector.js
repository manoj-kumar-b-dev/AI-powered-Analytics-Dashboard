const { z } = require('zod');
const { buildPrompt } = require('./promptBuilder');
const { executeWithRetry } = require('./retryHandler');
const { updateColumnRoles } = require('../../repositories/datasetRepository');

const ALLOWED_ROLES = [
  'Primary KPI',
  'Secondary KPI',
  'Dimension',
  'Identifier',
  'Date',
  'Currency',
  'Percentage',
  'Ignore',
  'Trend'
];

const columnRoleSchema = z.object({
  columnName: z.string(),
  businessRole: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

const responseSchema = z.array(columnRoleSchema);

const systemInstruction = `You are a database classification system. Your task is to refine the business role classification for specific ambiguous columns in a dataset.

You must categorize each ambiguous column into exactly ONE of the following business roles:
- Primary KPI: A key numeric business metrics or performance indicators (e.g. total revenue, net profit, user signup count).
- Secondary KPI: Supporting numeric metrics (e.g. quantity, score, rating, discount percentage).
- Dimension: Descriptive categories, names, statuses, or groupable text attributes (e.g. status, region, city, color).
- Identifier: Database keys, unique UUIDs/GUIDs, emails, usernames, or lookup tokens (e.g. customer_id, txn_number).
- Date: Dates, timestamps, quarters, or periods (e.g. created_at, signup_date).
- Currency: Monetary numeric fields.
- Percentage: Suffix % or rate metrics.
- Ignore: PII information (phone numbers, full names, URLs) or technical system columns that should be omitted from analysis.
- Trend: Sequence numbers, indices, or time-series timestamps indicating trends.

Return ONLY a JSON array containing objects conforming exactly to this structure (do not include markdown code fences, conversational comments, or explanations):
[
  {
    "columnName": "the name of the column",
    "businessRole": "one of the roles listed above",
    "confidence": 0.85,
    "reason": "1-2 sentence explanation of your decision"
  }
]`;

/**
 * Mappings of column business roles using rules-based baseline with cost-saving selective AI routing.
 *
 * @param {string} datasetId - The database ID of the dataset (DataSource).
 * @param {Object} input - Execution parameters.
 * @param {string} input.datasetType - The classified business domain (from Phase 5).
 * @param {Object} input.metadata - Dataset schema metadata (from Phase 2).
 * @param {Array} input.ruleBaseline - Column roles derived from the Rule Engine (from Phase 3).
 * @param {Array} [input.sampleRows] - Unmodified sample rows of the dataset.
 * @returns {Promise<Array>} The merged array of final column roles.
 */
const detectColumnRoles = async (datasetId, { datasetType, metadata, ruleBaseline, sampleRows }) => {
  const finalColumnRoles = [];
  const ambiguousColumns = [];

  // 1. Separate high-confidence rules from ambiguous columns
  (ruleBaseline || []).forEach(col => {
    const isHighConfidence = col.confidence >= 0.85 && col.needsReview !== true;
    if (isHighConfidence) {
      finalColumnRoles.push({
        columnName: col.columnName,
        detectedType: col.detectedType,
        businessRole: col.businessRole,
        confidence: col.confidence,
        reason: col.reason || 'Classified via high confidence rules',
        source: 'rule'
      });
    } else {
      ambiguousColumns.push(col);
    }
  });

  // 2. If no ambiguous columns, persist directly and skip AI execution
  if (ambiguousColumns.length === 0) {
    try {
      await updateColumnRoles(datasetId, finalColumnRoles);
    } catch (error) {
      console.error(`[columnRoleDetector] Failed to save rules-only column roles for dataset ${datasetId}:`, error);
    }
    return finalColumnRoles;
  }

  // 3. Formulate the prompt for ambiguous columns only
  const extraContext = {
    datasetType,
    ambiguousColumnsToClassify: ambiguousColumns.map(c => ({
      columnName: c.columnName,
      baselineDetectedType: c.detectedType,
      baselineBusinessRole: c.businessRole,
      baselineConfidence: c.confidence,
      baselineReason: c.reason
    }))
  };

  const prompt = buildPrompt({
    task: 'Determine the correct refined business role for only the specified ambiguous columns.',
    metadata,
    sampleRows,
    extraContext
  });

  // 4. Call the LLM retry handler
  const response = await executeWithRetry({
    prompt,
    systemInstruction,
    schema: responseSchema,
    responseMimeType: 'application/json'
  });

  // 5. Merge AI classifications with safe fallbacks
  ambiguousColumns.forEach(ambigCol => {
    let resolvedRole = null;

    if (response.success && Array.isArray(response.data)) {
      // Find matching item in AI response (case-insensitive)
      const aiMatch = response.data.find(
        item => (item.columnName || '').toString().trim().toLowerCase() === ambigCol.columnName.trim().toLowerCase()
      );

      if (aiMatch) {
        // Validate role is in allowed set
        const matchedRole = ALLOWED_ROLES.find(
          r => r.toLowerCase() === (aiMatch.businessRole || '').toString().trim().toLowerCase()
        );

        if (matchedRole) {
          resolvedRole = {
            columnName: ambigCol.columnName,
            detectedType: ambigCol.detectedType,
            businessRole: matchedRole,
            confidence: aiMatch.confidence,
            reason: aiMatch.reason,
            source: 'ai'
          };
        }
      }
    }

    // Fallback: If AI fails, misses, or returns invalid roles, use the Rule Engine guess
    if (!resolvedRole) {
      resolvedRole = {
        columnName: ambigCol.columnName,
        detectedType: ambigCol.detectedType,
        businessRole: ambigCol.businessRole,
        confidence: ambigCol.confidence,
        reason: `Fallback to rule engine. AI refinement failed or missed this column. ${ambigCol.reason || ''}`.trim(),
        source: 'rule'
      };
    }

    finalColumnRoles.push(resolvedRole);
  });

  // 6. Persist merged column roles in MongoDB
  try {
    await updateColumnRoles(datasetId, finalColumnRoles);
  } catch (error) {
    console.error(`[columnRoleDetector] Failed to save merged column roles for dataset ${datasetId}:`, error);
  }

  return finalColumnRoles;
};

module.exports = {
  detectColumnRoles,
  ALLOWED_ROLES
};
