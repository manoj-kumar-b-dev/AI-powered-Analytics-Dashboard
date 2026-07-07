const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantContext');

const dashboardPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', required: true },
  hiddenWidgetIds: [{ type: String }],
  pinnedWidgetIds: [{ type: String }],
  widgetOrder: [{ type: String }],
  widgetSizes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Enforce compound index for performance and unique queries scoped to user + dataset
dashboardPreferenceSchema.index({ userId: 1, datasetId: 1 }, { unique: true });

dashboardPreferenceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DashboardPreference', dashboardPreferenceSchema);
