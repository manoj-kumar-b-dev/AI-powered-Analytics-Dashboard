const express = require('express');
const passport = require('passport');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');
const { generateAccessToken, generateAndPersistRefreshToken, COOKIE_OPTIONS } = require('../services/authService');

const router = express.Router();

// POST /auth/register
router.post('/register', authController.register);

// POST /auth/login
router.post('/login', authController.login);

// POST /auth/refresh
router.post('/refresh', authController.refresh);

// POST /auth/logout
router.post('/logout', authController.logout);

// GET /auth/google - Initiate Google Authentication
router.get('/google', (req, res, next) => {
  const state = req.query.orgId ? JSON.stringify({ orgId: req.query.orgId }) : undefined;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false
  })(req, res, next);
});

// GET /auth/google/callback - Handle Google callback
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      console.error('Google Callback Auth Fail:', err);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }

    try {
      // Issue access token + refresh token
      const accessToken = generateAccessToken(user);
      const { rawToken, expiresAt } = await generateAndPersistRefreshToken(user._id);

      res.cookie('refreshToken', rawToken, {
        ...COOKIE_OPTIONS,
        expires: expiresAt,
        path: '/' // Ensure client receives it for /auth/refresh
      });

      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-success?token=${accessToken}`
      );
    } catch (tokenErr) {
      console.error('Error generating token on Google callback:', tokenErr);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=token_failed`);
    }
  })(req, res, next);
});

// PUT /auth/switch-org - Switches active org
router.put('/switch-org', requireAuth, authController.switchOrg);

// GET /auth/me - Get current user profile
router.get('/me', requireAuth, authController.me);

module.exports = router;
