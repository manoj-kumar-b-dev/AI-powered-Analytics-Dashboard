/**
 * Validates parsed JSON data against an expected schema.
 * Supports Zod schemas out of the box.
 *
 * @param {Object} data - The parsed JSON data object.
 * @param {Object} [schema] - The schema validator (e.g. Zod schema).
 * @returns {Object} Validation result: { success: true, data } or { success: false, error, details }
 */
const validateSchema = (data, schema) => {
  if (!schema) {
    return { success: true, data };
  }

  // Handle Zod schemas
  if (typeof schema.safeParse === 'function') {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      error: 'SCHEMA_VALIDATION_FAILURE',
      details: result.error.errors
    };
  }

  return {
    success: false,
    error: 'UNKNOWN_SCHEMA_FORMAT',
    details: 'The schema format provided is not supported (Zod expected).'
  };
};

module.exports = {
  validateSchema
};
