const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantContext');

const analyticsSchema = new mongoose.Schema({
  dataSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, required: true },
  kpis: { type: mongoose.Schema.Types.Mixed, default: [] },
  charts: { type: mongoose.Schema.Types.Mixed, default: [] },
  insights: { type: mongoose.Schema.Types.Mixed, default: [] },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  reports: { type: mongoose.Schema.Types.Mixed, default: {} },
  recommendations: { type: mongoose.Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

analyticsSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Analytics', analyticsSchema);
