const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const Org = require('../models/org');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const { inviteSchema, acceptInviteSchema } = require('../validators/orgValidator');
const { generateAndPersistRefreshToken, COOKIE_OPTIONS } = require('../services/authService');

exports.invite = async (req, res) => {
  try {
    const { orgId } = req.params;
    if (orgId !== req.user.orgId.toString()) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot invite users to an organisation you are not currently acting in'
        }
      });
    }

    const parseResult = inviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0].message
        }
      });
    }

    const { email, role } = parseResult.data;

    // Generate signed token
    const inviteToken = jwt.sign(
      { email, orgId, role },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/accept?token=${inviteToken}`;

    console.log(`[STUB] Invite link sent to ${email}: ${inviteLink}`);

    return res.status(200).json({
      message: 'Invite generated successfully',
      inviteLink,
      expiresIn: '48h'
    });
  } catch (err) {
    console.error('Invite Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong while generating invite'
      }
    });
  }
};

exports.acceptInvite = async (req, res) => {
  try {
    const parseResult = acceptInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0].message
        }
      });
    }

    const { token, name, password } = parseResult.data;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invite token is invalid or has expired'
        }
      });
    }

    const { email, orgId, role } = decoded;

    // Check if Org still exists
    const org = await Org.findById(orgId);
    if (!org) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The organization you were invited to no longer exists'
        }
      });
    }

    // Check if user already exists in this org
    let existingProfile = await User.findOne({ email, orgId });
    if (existingProfile) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'You are already a member of this organisation'
        }
      });
    }

    // Find if user exists globally
    const existingUser = await User.findOne({ email });

    let finalUser;
    if (existingUser) {
      finalUser = new User({
        email,
        name: existingUser.name,
        passwordHash: existingUser.passwordHash,
        googleId: existingUser.googleId,
        avatarUrl: existingUser.avatarUrl,
        orgId,
        role
      });
      await finalUser.save();
    } else {
      if (!name || !password) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Name and password are required for new registration'
          }
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      finalUser = new User({
        email,
        name,
        passwordHash,
        orgId,
        role
      });
      await finalUser.save();
    }

    // Issue access token
    const accessToken = jwt.sign(
      { userId: finalUser._id.toString(), orgId: finalUser.orgId.toString(), role: finalUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Reuse generateAndPersistRefreshToken from authService
    const { rawToken, expiresAt } = await generateAndPersistRefreshToken(finalUser._id);

    res.cookie('refreshToken', rawToken, {
      ...COOKIE_OPTIONS,
      expires: expiresAt
    });

    return res.status(200).json({
      accessToken,
      user: {
        userId: finalUser._id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
        orgId: finalUser.orgId
      }
    });
  } catch (err) {
    console.error('Accept Invite Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong while accepting invite'
      }
    });
  }
};

exports.getOrg = async (req, res) => {
  try {
    const { orgId } = req.params;
    if (orgId !== req.user.orgId.toString()) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access Denied'
        }
      });
    }

    const org = await Org.findById(orgId);
    if (!org) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Organisation not found'
        }
      });
    }

    return res.status(200).json(org);
  } catch (err) {
    console.error('Get Org Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong'
      }
    });
  }
};
