const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient, isRedisAvailable } = require('../config/redis');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased to 1000
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Trust X-Forwarded-For header (Vercel proxy)
  validate: {
    xForwardedForHeader: false,
    trustProxy: true
  }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  skipSuccessfulRequests: true,
  validate: {
    xForwardedForHeader: false,
    trustProxy: true
  }
});

// OTP request limiter
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 OTP requests per window
  message: {
    success: false,
    error: {
      code: 'OTP_LIMIT_EXCEEDED',
      message: 'Too many OTP requests, please try again after 5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    trustProxy: true
  }
});

// Payment limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    error: {
      code: 'PAYMENT_LIMIT_EXCEEDED',
      message: 'Too many payment attempts, please try again later'
    }
  },
  validate: {
    xForwardedForHeader: false,
    trustProxy: true
  }
});

// Location update limiter - 60 requests per minute (every second allowed)
const locationUpdateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 updates per minute (every second allowed)
  message: {
    success: false,
    error: {
      code: 'LOCATION_UPDATE_LIMIT_EXCEEDED',
      message: 'Location updates too frequent, please wait'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store if available (for multi-server support)
  store: isRedisAvailable() ? new RedisStore({
    sendCommand: (...args) => getRedisClient().sendCommand(args),
    prefix: 'ratelimit:location:'
  }) : undefined,
  // Use driver ID instead of IP for rate limiting
  keyGenerator: (req) => {
    // Use userId for authenticated requests, no IP fallback needed
    return req.userId ? req.userId.toString() : 'anonymous';
  },
  validate: {
    xForwardedForHeader: false,
    trustProxy: true,
    // Disable IP validation since we're using userId
    ip: false
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  locationUpdateLimiter
};
