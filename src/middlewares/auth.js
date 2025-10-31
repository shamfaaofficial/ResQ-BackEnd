const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const asyncHandler = require('express-async-handler');

/**
 * Verify JWT access token and attach user to request
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Find user
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    }
    throw error;
  }
});

/**
 * Role-based access control middleware
 */
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError('Access denied. Insufficient permissions');
    }

    next();
  };
};

/**
 * Check if driver is approved
 */
const checkDriverApproval = asyncHandler(async (req, res, next) => {
  const driver = await Driver.findOne({ userId: req.userId });

  if (!driver) {
    throw new AuthorizationError('Driver profile not found');
  }

  if (driver.approvalStatus !== 'approved') {
    throw new AuthorizationError('Driver account is not approved yet');
  }

  req.driver = driver;
  req.driverId = driver._id;

  next();
});

/**
 * Optional auth - attach user if token exists but don't fail if not
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
      }
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next();
});

module.exports = {
  authMiddleware,
  roleMiddleware,
  checkDriverApproval,
  optionalAuth
};
