const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantContext');

const dataSourceSchema = new mongoose.Schema({
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  schema: [{
    column: { type: String, required: true },
    type: { type: String, enum: ['numeric', 'date', 'categorical', 'boolean', 'text'], required: true },
    detectedType: { type: String },
    nullable: { type: Boolean, default: false },
    sampleValues: [{ type: String }]
  }],
  kpiMapping: {
    revenue: { type: String },
    sales: { type: String },
    customers: { type: String },
    expenses: { type: String },
    profit: { type: String },
    date: { type: String }
  },
  validation: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ problemCount: 0, problemSamples: [] })
  },
  rowCount: { type: Number, required: true },
  status: { type: String, enum: ['preview', 'confirmed'], default: 'preview', required: true },
  isActive: { type: Boolean, default: false },

  datasetType: { type: String },
  confidence: { type: Number },
  reason: { type: String },
  classifiedAt: { type: Date },

  columnRoles: [{
    columnName: { type: String, required: true },
    detectedType: { type: String },
    businessRole: { type: String },
    confidence: { type: Number },
    reason: { type: String },
    source: { type: String, enum: ['rule', 'ai'] }
  }],

  kpis: [{
    name: { type: String, required: true },
    description: { type: String },
    sourceColumns: [{ type: String }],
    aggregation: { type: String, enum: ['sum', 'avg', 'count', 'ratio'], required: true },
    priority: { type: String, enum: ['primary', 'secondary'], required: true }
  }],

  charts: [{
    title: { type: String, required: true },
    type: { type: String, enum: ['line', 'bar', 'pie', 'area', 'table'], required: true },
    xAxis: { type: String, required: true },
    yAxis: { type: String, required: true },
    groupBy: { type: String },
    reason: { type: String }
  }],

  dashboardConfig: { type: mongoose.Schema.Types.Mixed },

  createdAt: { type: Date, default: Date.now }
});

dataSourceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DataSource', dataSourceSchema);
