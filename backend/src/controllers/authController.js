const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Org = require('../models/org');
const RefreshToken = require('../models/refreshToken');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const {
  hashToken,
  generateAccessToken,
  generateAndPersistRefreshToken,
  COOKIE_OPTIONS
} = require('../services/authService');

exports.register = async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0].message
        }
      });
    }

    const { name, email, password } = parseResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'A user with this email already exists'
        }
      });
    }

    // Auto-provision Organization
    const newOrg = new Org({
      name: `${name}'s Workspace`,
      plan: 'free'
    });
    await newOrg.save();

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create User
    const newUser = new User({
      name,
      email,
      passwordHash,
      orgId: newOrg._id,
      role: 'owner'
    });
    await newUser.save();

    // Update Org owner
    newOrg.ownerId = newUser._id;
    await newOrg.save();

    // Issue Tokens
    const accessToken = generateAccessToken(newUser);
    const { rawToken, expiresAt } = await generateAndPersistRefreshToken(newUser._id);

    res.cookie('refreshToken', rawToken, {
      ...COOKIE_OPTIONS,
      expires: expiresAt
    });

    return res.status(201).json({
      accessToken,
      user: {
        userId: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        orgId: newUser.orgId
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong during registration'
      }
    });
  }
};

exports.login = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0].message
        }
      });
    }

    const { email, password } = parseResult.data;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        }
      });
    }

    const accessToken = generateAccessToken(user);
    const { rawToken, expiresAt } = await generateAndPersistRefreshToken(user._id);

    res.cookie('refreshToken', rawToken, {
      ...COOKIE_OPTIONS,
      expires: expiresAt
    });

    return res.status(200).json({
      accessToken,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong during login'
      }
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    // Read from cookie (first choice) or fallback to request body
    const rawRefreshToken = (req.cookies && req.cookies.refreshToken) || (req.body && req.body.refreshToken);

    if (!rawRefreshToken) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Refresh token is required'
        }
      });
    }

    const tokenHash = hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });

    if (!tokenDoc) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token'
        }
      });
    }

    // Reuse/theft detection
    if (tokenDoc.revoked) {
      // Revoke the entire family
      await RefreshToken.updateMany({ familyId: tokenDoc.familyId }, { revoked: true });
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Refresh token has been reused. Access revoked for this session family. Please log in again.'
        }
      });
    }

    // Expiry check
    if (tokenDoc.expiresAt < new Date()) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token expired'
        }
      });
    }

    // Invalidate old token (mark revoked)
    tokenDoc.revoked = true;
    await tokenDoc.save();

    // Fetch user to ensure user still exists
    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User no longer exists'
        }
      });
    }

    // Rotate: Issue new access token + new refresh token in the same family
    const accessToken = generateAccessToken(user);
    const { rawToken: newRawToken, expiresAt } = await generateAndPersistRefreshToken(user._id, tokenDoc.familyId);

    res.cookie('refreshToken', newRawToken, {
      ...COOKIE_OPTIONS,
      expires: expiresAt
    });

    return res.status(200).json({
      accessToken
    });
  } catch (err) {
    console.error('Refresh Token Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong during token refresh'
      }
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const rawRefreshToken = (req.cookies && req.cookies.refreshToken) || (req.body && req.body.refreshToken);
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash }, { revoked: true });
    }

    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong during logout'
      }
    });
  }
};

exports.switchOrg = async (req, res) => {
  try {
    const { orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'orgId is required' } });
    }

    const userOrgDocs = await User.find({ email: req.user.email || '' });
    const targetUserDoc = userOrgDocs.find(doc => doc.orgId.toString() === orgId.toString());

    if (!targetUserDoc) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not belong to this organisation'
        }
      });
    }

    // Issue new JWT and refresh token with target user doc credentials
    const accessToken = generateAccessToken(targetUserDoc);
    const { rawToken, expiresAt } = await generateAndPersistRefreshToken(targetUserDoc._id);

    res.cookie('refreshToken', rawToken, {
      ...COOKIE_OPTIONS,
      expires: expiresAt
    });

    return res.status(200).json({
      accessToken,
      user: {
        userId: targetUserDoc._id,
        name: targetUserDoc.name,
        email: targetUserDoc.email,
        role: targetUserDoc.role,
        orgId: targetUserDoc.orgId
      }
    });
  } catch (err) {
    console.error('Switch Org Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong while switching organisations'
      }
    });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // Return list of other orgs user belongs to (multi-tenant dashboard support)
    const allProfiles = await User.find({ email: user.email });
    const orgIds = allProfiles.map(p => p.orgId);
    const orgs = await Org.find({ _id: { $in: orgIds } });

    return res.status(200).json({
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId
      },
      organisations: orgs.map(o => ({
        orgId: o._id,
        name: o.name,
        role: allProfiles.find(p => p.orgId.toString() === o._id.toString()).role
      }))
    });
  } catch (err) {
    console.error('Get Me Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong'
      }
    });
  }
};
