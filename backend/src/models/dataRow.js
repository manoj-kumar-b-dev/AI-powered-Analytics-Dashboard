const mongoose = require('mongoose');
const { tenantPlugin } = require('../middleware/tenantContext');

const dataRowSchema = new mongoose.Schema({
  dataSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

dataRowSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DataRow', dataRowSchema);
