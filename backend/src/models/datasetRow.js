const mongoose = require('mongoose');

const datasetRowSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});

module.exports = mongoose.model('DatasetRow', datasetRowSchema);
