const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/refreshToken');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), orgId: user.orgId.toString(), role: user.role },
    process.env.JWT_SECRET || 'default_test_jwt_secret_must_be_long_enough_to_avoid_weak_key_errors_so_we_make_it_very_long',
    { expiresIn: '15m' }
  );
};

const generateAndPersistRefreshToken = async (userId, familyId = null) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const finalFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days duration

  const refreshTokenDoc = new RefreshToken({
    userId,
    tokenHash,
    familyId: finalFamilyId,
    expiresAt
  });
  await refreshTokenDoc.save();

  return { rawToken, expiresAt };
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/auth/refresh' // Limit cookie sent only to refresh endpoint for security
};

module.exports = {
  hashToken,
  generateAccessToken,
  generateAndPersistRefreshToken,
  COOKIE_OPTIONS
};
