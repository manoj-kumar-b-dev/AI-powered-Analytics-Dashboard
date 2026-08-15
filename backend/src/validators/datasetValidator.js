const { z } = require('zod');

const askQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty').max(500, 'Question is too long (max 500 characters)'),
  history: z.array(z.any()).optional()
});

const datasetIdParamSchema = z.object({
  datasetId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid dataset ID format')
});

module.exports = {
  askQuestionSchema,
  datasetIdParamSchema
};
