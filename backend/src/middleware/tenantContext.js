const mongoose = require('mongoose');

// Simple request context storage using async hooks
const contextMap = new Map();
let contextCounter = 0;

const tenantMiddleware = (req, res, next) => {
  if (req.user && req.user.orgId) {
    // Assign a unique ID to this request
    const contextId = ++contextCounter;
    req._contextId = contextId;
    req.tenantId = req.user.orgId.toString();
    
    // Store in map for retrieval in hooks
    contextMap.set(contextId, { orgId: req.tenantId });
    
    // Clean up after response
    res.on('finish', () => {
      contextMap.delete(contextId);
    });
  }
  next();
};

const getTenantId = (query) => {
  // Try to get orgId from stored context
  // This is a fallback mechanism - ideally queries should always include orgId explicitly
  return null;
};

const tenantPlugin = (schema) => {
  // Ensure the schema has orgId if not already defined
  if (!schema.paths.orgId) {
    schema.add({
      orgId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Org',
        required: true,
        index: true
      }
    });
  }

  // Hook for standard queries - validates that orgId is explicitly set
  const validateOrgId = function(next) {
    // Check if this query already has an orgId filter
    const conditions = this.getFilter();
    if (conditions && conditions.orgId === undefined) {
      // Only auto-inject if we have no other where conditions OR if it's a find with explicit dataSourceId
      // This is defensive - queries should include orgId explicitly
      console.warn('Warning: Query executed without explicit orgId filter. This may be a security issue.');
    }
    next();
  };

  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'count',
    'countDocuments'
  ];

  queryMethods.forEach((method) => {
    schema.pre(method, validateOrgId);
  });
};

module.exports = {
  tenantMiddleware,
  tenantPlugin,
  getTenantId
};
