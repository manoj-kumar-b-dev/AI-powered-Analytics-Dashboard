const rateMap = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 30; // Max 30 questions per 15 minutes per user

/**
 * Express middleware for rate limiting AI question requests.
 */
const aiRateLimiter = (req, res, next) => {
  const identifier = req.user?.userId || req.ip || 'anonymous';
  const now = Date.now();

  let userRecord = rateMap.get(identifier);

  if (!userRecord || now - userRecord.startTime > WINDOW_MS) {
    userRecord = {
      count: 1,
      startTime: now
    };
    rateMap.set(identifier, userRecord);
    return next();
  }

  if (userRecord.count >= MAX_REQUESTS) {
    const resetTimeSeconds = Math.ceil((userRecord.startTime + WINDOW_MS - now) / 1000);
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many AI question requests. Please try again in ${resetTimeSeconds} seconds.`
      }
    });
  }

  userRecord.count += 1;
  next();
};

module.exports = {
  aiRateLimiter
};
