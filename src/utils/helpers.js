const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hashed password
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT access token
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY }
  );
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP for storage
 */
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Generate unique booking number
 */
const generateBookingNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `RESQ-${timestamp}-${random}`;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return parseFloat(distance.toFixed(2));
};

const toRad = (value) => {
  return (value * Math.PI) / 180;
};

/**
 * Format Qatar phone number
 */
const formatQatarPhone = (phoneNumber) => {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Check if it starts with 974 (country code)
  if (cleaned.startsWith('974')) {
    return `+${cleaned}`;
  }

  // Check if it's 8 digits (local number)
  if (cleaned.length === 8) {
    return `+974${cleaned}`;
  }

  // If already has +, return as is
  if (phoneNumber.startsWith('+974')) {
    return phoneNumber;
  }

  return `+974${cleaned}`;
};

/**
 * Validate Qatar phone number
 */
const isValidQatarPhone = (phoneNumber) => {
  const formatted = formatQatarPhone(phoneNumber);
  const regex = /^\+974[3567]\d{7}$/;
  return regex.test(formatted);
};

/**
 * Pagination helper
 */
const getPagination = (page, limit) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const skip = (currentPage - 1) * itemsPerPage;
  return { skip, limit: itemsPerPage, page: currentPage };
};

/**
 * Response formatter
 */
const successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

const errorResponse = (message, errorCode = 'ERROR', details = {}) => {
  return {
    success: false,
    error: {
      code: errorCode,
      message,
      details
    }
  };
};

/**
 * Sanitize MongoDB query (prevent injection)
 */
const sanitizeQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('$')) {
      continue; // Skip MongoDB operators
    }
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeQuery(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Calculate trip pricing
 */
const calculateTripPrice = (distance, pricingConfig) => {
  const basePrice = pricingConfig.basePrice;
  const perKmRate = pricingConfig.perKmRate;
  const serviceFeePercentage = pricingConfig.serviceFeePercentage || 0;

  const distancePrice = distance * perKmRate;
  const subtotal = basePrice + distancePrice;
  const serviceFee = (subtotal * serviceFeePercentage) / 100;
  const totalAmount = subtotal + serviceFee;

  return {
    basePrice,
    perKmRate,
    totalDistance: distance,
    distancePrice: parseFloat(distancePrice.toFixed(2)),
    serviceFee: parseFloat(serviceFee.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    currency: 'QAR'
  };
};

/**
 * Calculate driver earnings
 */
const calculateDriverEarnings = (totalAmount, platformCommissionPercentage) => {
  const commission = (totalAmount * platformCommissionPercentage) / 100;
  const driverEarnings = totalAmount - commission;

  return {
    totalAmount,
    platformCommission: parseFloat(commission.toFixed(2)),
    driverEarnings: parseFloat(driverEarnings.toFixed(2))
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateOTP,
  hashOTP,
  generateBookingNumber,
  calculateDistance,
  formatQatarPhone,
  isValidQatarPhone,
  getPagination,
  successResponse,
  errorResponse,
  sanitizeQuery,
  calculateTripPrice,
  calculateDriverEarnings
};
