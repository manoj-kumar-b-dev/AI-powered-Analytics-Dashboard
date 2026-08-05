const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
    token = req.cookies.accessToken || req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is required'
      }
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'default_test_jwt_secret_must_be_long_enough_to_avoid_weak_key_errors_so_we_make_it_very_long';
    const decoded = jwt.verify(token, secret);
    req.user = {
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role
    };
    
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token'
      }
    });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action'
        }
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole
};
