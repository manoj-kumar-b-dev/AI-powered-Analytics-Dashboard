const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { tenantPlugin } = require('../middleware/tenantContext');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String }, // Nullable for Google OAuth users
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  avatarUrl: { type: String },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member', required: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.plugin(tenantPlugin);


userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
