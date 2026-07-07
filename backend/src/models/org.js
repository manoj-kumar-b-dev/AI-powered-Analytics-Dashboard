const mongoose = require('mongoose');

const orgSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  plan: { type: String, enum: ['free', 'growth', 'enterprise'], default: 'free', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Org', orgSchema);
