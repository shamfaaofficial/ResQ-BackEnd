require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDatabase = require('../src/config/database.vercel');
const errorHandler = require('../src/middlewares/errorHandler');
const { generalLimiter } = require('../src/middlewares/rateLimiter');

// Import routes
const authRoutes = require('../src/routes/auth.routes');
const userRoutes = require('../src/routes/user.routes');
const driverRoutes = require('../src/routes/driver.routes');
const adminRoutes = require('../src/routes/admin.routes');
const utilsRoutes = require('../src/routes/utils.routes');

// Initialize Express app
const app = express();

// Trust proxy - Required for Vercel serverless functions
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting - Temporarily disabled for Vercel debugging
// app.use('/api', generalLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RESQ Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      user: '/api/v1/user',
      driver: '/api/v1/driver',
      admin: '/api/v1/admin',
      utils: '/api/v1/utils'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RESQ Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/utils', utilsRoutes);

// Serve uploaded files (Note: In serverless, consider using cloud storage like S3 or Cloudinary)
app.use('/uploads', express.static('uploads'));

// Global error handler
app.use(errorHandler);

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Serverless function handler
module.exports = async (req, res) => {
  try {
    // Connect to database before handling request
    await connectDatabase();

    // Handle the request with Express app
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    console.error('Error stack:', error.stack);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An error occurred processing your request'
        }
      });
    }
  }
};
