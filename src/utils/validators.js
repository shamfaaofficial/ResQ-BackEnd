const Joi = require('joi');
const { ROLES, VEHICLE_TYPES, OTP_PURPOSE } = require('../config/constants');

// Common schemas
const phoneSchema = Joi.string()
  .pattern(/^\+?974[3567]\d{7}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid Qatar phone number format'
  });

const otpSchema = Joi.string()
  .length(6)
  .pattern(/^\d+$/)
  .required()
  .messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers'
  });

const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least one uppercase, one lowercase, and one number'
  });

// Auth validators
const signupValidator = Joi.object({
  phoneNumber: phoneSchema,
  countryCode: Joi.string().default('+974')
});

const verifyOtpValidator = Joi.object({
  phoneNumber: phoneSchema,
  otp: otpSchema,
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: passwordSchema,
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().optional()
});

const loginValidator = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const forgotPasswordValidator = Joi.object({
  phoneNumber: phoneSchema
});

const resetPasswordValidator = Joi.object({
  phoneNumber: phoneSchema,
  otp: otpSchema,
  newPassword: passwordSchema
});

const refreshTokenValidator = Joi.object({
  refreshToken: Joi.string().required()
});

// Driver document submission
const driverDocumentsValidator = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VEHICLE_TYPES)).required(),
  vehicleNumber: Joi.string().required(),
  vehicleMake: Joi.string().required(),
  vehicleModel: Joi.string().required(),
  vehicleYear: Joi.number().min(1990).max(new Date().getFullYear() + 1).required(),
  vehicleColor: Joi.string().required()
});

// Profile update validators
const updateProfileValidator = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  email: Joi.string().email()
}).min(1);

const updateVehicleValidator = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VEHICLE_TYPES)),
  vehicleNumber: Joi.string(),
  vehicleMake: Joi.string(),
  vehicleModel: Joi.string(),
  vehicleYear: Joi.number().min(1990).max(new Date().getFullYear() + 1),
  vehicleColor: Joi.string()
}).min(1);

const updateBankDetailsValidator = Joi.object({
  accountHolderName: Joi.string().required(),
  bankName: Joi.string().required(),
  accountNumber: Joi.string().required(),
  iban: Joi.string().required()
});

// Location validators
const locationValidator = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().optional()
});

const updateLocationValidator = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().optional()
});

// Booking validators
const searchDriversValidator = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VEHICLE_TYPES)).required(),
  pickupLocation: locationValidator.required(),
  searchRadius: Joi.number().min(1).max(50).default(10)
});

const createBookingValidator = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VEHICLE_TYPES)).required(),
  pickupLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    address: Joi.string().required(),
    placeName: Joi.string().optional()
  }).required(),
  dropoffLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    address: Joi.string().required(),
    placeName: Joi.string().optional()
  }).required(),
  notes: Joi.string().max(500).optional()
});

const startTripValidator = Joi.object({
  actualDropoffLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    address: Joi.string().required()
  }).optional()
});

const cancelBookingValidator = Joi.object({
  reason: Joi.string().min(10).max(500).required()
});

// Pricing validators
const createPricingValidator = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VEHICLE_TYPES)).required(),
  basePrice: Joi.number().min(0).required(),
  perKmRate: Joi.number().min(0).required(),
  minimumFare: Joi.number().min(0).required(),
  serviceFeePercentage: Joi.number().min(0).max(100).default(0),
  driverCommissionPercentage: Joi.number().min(0).max(100).required()
});

const updatePricingValidator = Joi.object({
  basePrice: Joi.number().min(0),
  perKmRate: Joi.number().min(0),
  minimumFare: Joi.number().min(0),
  serviceFeePercentage: Joi.number().min(0).max(100),
  driverCommissionPercentage: Joi.number().min(0).max(100),
  isActive: Joi.boolean()
}).min(1);

// Withdrawal validator
const withdrawalRequestValidator = Joi.object({
  amount: Joi.number().min(10).required()
});

// Notification validator
const sendNotificationValidator = Joi.object({
  userId: Joi.string(),
  driverId: Joi.string(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  type: Joi.string().required()
}).xor('userId', 'driverId');

// Admin validators
const approveDriverValidator = Joi.object({
  reason: Joi.string().optional()
});

const rejectDriverValidator = Joi.object({
  reason: Joi.string().min(10).required()
});

const updateUserStatusValidator = Joi.object({
  isActive: Joi.boolean().required()
});

// Pagination validator
const paginationValidator = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  search: Joi.string().optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  signupValidator,
  verifyOtpValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  driverDocumentsValidator,
  updateProfileValidator,
  updateVehicleValidator,
  updateBankDetailsValidator,
  locationValidator,
  updateLocationValidator,
  searchDriversValidator,
  createBookingValidator,
  startTripValidator,
  cancelBookingValidator,
  createPricingValidator,
  updatePricingValidator,
  withdrawalRequestValidator,
  sendNotificationValidator,
  approveDriverValidator,
  rejectDriverValidator,
  updateUserStatusValidator,
  paginationValidator
};
