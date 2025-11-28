const Joi = require('joi');

/**
 * Validation schema for creating or getting chat
 */
exports.createOrGetChat = {
  body: Joi.object({
    bookingId: Joi.string()
      .required()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid booking ID format',
        'any.required': 'Booking ID is required',
      }),
    userId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid user ID format',
      }),
    driverId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid driver ID format',
      }),
  }),
};

/**
 * Validation schema for chat ID parameter
 */
exports.chatIdParam = {
  params: Joi.object({
    chatId: Joi.string()
      .required()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid chat ID format',
        'any.required': 'Chat ID is required',
      }),
  }),
};

/**
 * Validation schema for booking ID parameter
 */
exports.getChatByBookingId = {
  params: Joi.object({
    bookingId: Joi.string()
      .required()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid booking ID format',
        'any.required': 'Booking ID is required',
      }),
  }),
};

/**
 * Validation schema for getting chat messages
 */
exports.getChatMessages = {
  params: Joi.object({
    chatId: Joi.string()
      .required()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid chat ID format',
        'any.required': 'Chat ID is required',
      }),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),
};

/**
 * Validation schema for sending a message
 */
exports.sendMessage = {
  params: Joi.object({
    chatId: Joi.string()
      .required()
      .regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid chat ID format',
        'any.required': 'Chat ID is required',
      }),
  }),
  body: Joi.object({
    messageType: Joi.string()
      .valid('text', 'image', 'location', 'system')
      .default('text'),
    content: Joi.string()
      .max(2000)
      .when('messageType', {
        is: Joi.valid('text', 'system'),
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'string.max': 'Message content cannot exceed 2000 characters',
        'any.required': 'Message content is required for text messages',
      }),
    imageUrl: Joi.string()
      .uri()
      .when('messageType', {
        is: 'image',
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'string.uri': 'Invalid image URL format',
        'any.required': 'Image URL is required for image messages',
      }),
    location: Joi.object({
      type: Joi.string().valid('Point').required(),
      coordinates: Joi.array()
        .length(2)
        .items(Joi.number())
        .required()
        .messages({
          'array.length': 'Coordinates must contain exactly 2 numbers [longitude, latitude]',
        }),
      address: Joi.string().optional(),
    }).when('messageType', {
      is: 'location',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),
};
