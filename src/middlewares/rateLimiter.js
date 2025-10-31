const rateLimit = require('express-rate-limit');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting if trust proxy is not set (will be handled by error)
  skip: (req) => false,
  // Use X-Forwarded-For header for client IP in serverless environments
  validate: { xForwardedForHeader: false }
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
  validate: { xForwardedForHeader: false }
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
  validate: { xForwardedForHeader: false }
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
  validate: { xForwardedForHeader: false }
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter
};
