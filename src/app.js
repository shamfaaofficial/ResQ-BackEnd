require('dotenv').config();

// Fallback Google Maps API key if not in .env
if (!process.env.GOOGLE_MAPS_API_KEY) {
  process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyD2wCBhTvkx8inJorD8K-ZrbtcaYIAQzPU';
  console.log('✅ Using hardcoded Google Maps API key');
}

// Fallback Firebase Service Account path for local development only
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Only use file path in local development
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = './src/config/resq-7cd08-firebase-adminsdk-fbsvc-78361eb6c6.json';
  console.log('✅ Using Firebase service account file (local development)');
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDatabase = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const driverRoutes = require('./routes/driver.routes');
const adminRoutes = require('./routes/admin.routes');
const utilsRoutes = require('./routes/utils.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const tripRoutes = require('./routes/trip.routes');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN,
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

// Rate limiting
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const firebaseConfig = require('./config/firebase');
  const googleMaps = require('./config/googleMaps');
  const { isRedisAvailable } = require('./config/redis');

  res.status(200).json({
    success: true,
    message: 'RESQ Backend API is running perfeclty',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    services: {
      firebase: firebaseConfig.isInitialized() ? '✅ Connected' : '⚠️ Not configured',
      googleMaps: googleMaps.isAvailable() ? '✅ Configured' : '⚠️ Not configured',
      redis: isRedisAvailable() ? '✅ Connected' : '⚠️ Not connected',
      mongodb: '✅ Connected' // If server is running, MongoDB is connected
    }
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/trip', tripRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/utils',  utilsRoutes);

// Serve uploaded files
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

// Connect to database and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis (optional - app works without it)
    const { connectRedis } = require('./config/redis');
    await connectRedis();

    // Start background jobs
    require('./jobs/booking.job');

    // Start HTTP server
    const http = require('http');
    const server = http.createServer(app);

    // Initialize Socket.io
    const { initializeSocket } = require('./config/socket');
    initializeSocket(server);

    // Start server
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════╗
║   RESQ Backend API Server Started    ║
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV}           ║
║   Time: ${new Date().toLocaleString()}  ║
╚═══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server and exit
  process.exit(1);
});

module.exports = app;


// Test cicd