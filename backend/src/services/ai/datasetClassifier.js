const { z } = require('zod');
const { buildPrompt } = require('./promptBuilder');
const { executeWithRetry } = require('./retryHandler');
const { updateClassification } = require('../../repositories/datasetRepository');

const ALLOWED_TYPES = [
  'Sales',
  'Marketing',
  'Finance',
  'HR',
  'Inventory',
  'Healthcare',
  'CRM',
  'Education',
  'Manufacturing',
  'Banking',
  'Custom'
];

const classificationSchema = z.object({
  datasetType: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

const systemInstruction = `You are a database classification system. Your task is to analyze a dataset based on its schema, column business roles, and sample data, and classify its business domain.

You must categorize the dataset into exactly ONE of the following types:
- Sales
- Marketing
- Finance
- HR
- Inventory
- Healthcare
- CRM
- Education
- Manufacturing
- Banking
- Custom

Return ONLY a JSON object conforming exactly to this structure (do not include markdown code fences, conversational comments, or explanations):
{
  "datasetType": "one of the types listed above",
  "confidence": 0.95,
  "reason": "1-2 sentence explanation of your decision"
}`;

/**
 * Classifies the overall business domain of a dataset, coerces outliers,
 * and persists the result to MongoDB on the dataset record.
 *
 * @param {string} datasetId - The database ID of the dataset (DataSource).
 * @param {Object} input - Analytical profile details.
 * @param {Object} input.metadata - Dataset schema metadata.
 * @param {Array} input.columnClassifications - Business role classifications of the columns.
 * @param {Array} [input.sampleRows] - Unmodified sample rows of the dataset.
 * @returns {Promise<Object>} The classification result object.
 */
const classifyDataset = async (datasetId, { metadata, columnClassifications, sampleRows }) => {
  const extraContext = {
    columnClassifications: (columnClassifications || []).map(c => ({
      columnName: c.columnName,
      detectedType: c.detectedType,
      businessRole: c.businessRole
    }))
  };

  // 1. Format LLM prompt limiting samples to 5
  const prompt = buildPrompt({
    task: 'Classify this dataset overall business domain using the columns, classifications, and sample rows.',
    metadata,
    sampleRows,
    extraContext
  });

  let classificationResult;

  // 2. Call the LLM retry handler
  const response = await executeWithRetry({
    prompt,
    systemInstruction,
    schema: classificationSchema,
    responseMimeType: 'application/json'
  });

  if (response.success) {
    let { datasetType, confidence, reason } = response.data;

    // Check against closed set (case-insensitive)
    const matchedType = ALLOWED_TYPES.find(
      t => t.toLowerCase() === (datasetType || '').toString().trim().toLowerCase()
    );

    if (matchedType) {
      datasetType = matchedType;
    } else {
      // Coerce outlier types to Custom and lower confidence
      const originalType = datasetType;
      datasetType = 'Custom';
      confidence = Math.max(0, confidence - 0.2);
      reason = `Coerced to Custom. Original model classification was "${originalType}". ${reason}`;
    }

    classificationResult = {
      datasetType,
      confidence,
      reason
    };
  } else {
    // Graceful degradation: log warning and store fallback state to not block the upload flow
    console.warn(`[datasetClassifier] AI classification failed for dataset ${datasetId}. Using fallback 'Unclassified'.`);
    classificationResult = {
      datasetType: 'Unclassified',
      confidence: 0,
      reason: `AI classification failed after retries. Technical details: ${response.details?.message || 'unknown error'}`
    };
  }

  // 3. Persist results in MongoDB via Repository
  try {
    await updateClassification(datasetId, classificationResult);
  } catch (error) {
    console.error(`[datasetClassifier] Failed to save classification results for dataset ${datasetId}:`, error);
  }

  return classificationResult;
};

module.exports = {
  classifyDataset,
  ALLOWED_TYPES
};
