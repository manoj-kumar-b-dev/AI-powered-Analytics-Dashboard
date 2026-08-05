const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['string', 'number', 'date', 'boolean'], required: true }
}, { _id: false });

const datasetSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, required: true },
  rowCount: { type: Number, required: true },
  columns: [columnSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dataset', datasetSchema);
