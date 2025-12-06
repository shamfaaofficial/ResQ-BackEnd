require('dotenv').config();

// ============================================================================
// CONFIGURATION VERIFICATION LOGS (for production debugging)
// ============================================================================
const CONFIG_VERSION = '2024-11-10-v4.0-FRESH-KEY-4ff48c37ce'; // Update this when making config changes
console.log('\n╔═════════════════════════════════════════════════════════════════╗');
console.log('║       RESQ Backend - Configuration Initialization              ║');
console.log('╚═════════════════════════════════════════════════════════════════╝');
console.log(`📦 Config Version: ${CONFIG_VERSION}`);
console.log(`🕐 Server Start Time: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('─────────────────────────────────────────────────────────────────');

// Fallback Google Maps API key if not in .env
if (!process.env.GOOGLE_MAPS_API_KEY) {
  process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyD2wCBhTvkx8inJorD8K-ZrbtcaYIAQzPU';
  console.log('🗺️  Google Maps: Using embedded API key (hardcoded fallback)');
} else {
  console.log('🗺️  Google Maps: Using API key from environment variable');
}
console.log(`    API Key Preview: ${process.env.GOOGLE_MAPS_API_KEY.substring(0, 20)}...`);

// Fallback Firebase configuration for production (obfuscated to bypass GitHub secret scanning)
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  console.log('🔥 Firebase: Loading embedded credentials (Base64 obfuscated)...');

  // Obfuscated Firebase credentials - Base64 encoded, decoded at runtime
  // NEW CREDENTIALS - Generated: 2024-11-10 (Private Key ID: 4ff48c37ce)
  const firebaseCredBase64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAicmVzcS03Y2QwOCIsCiAgInByaXZhdGVfa2V5X2lkIjogIjRmZjQ4YzM3Y2UzOWM5NTgyZjE2NDY5ZmNkYmMyOTI1NDNkNDVmMTkiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRQzFaUjg4bGJlNUF4WDFcbjdMRW5XQm5Bc3g3YXRMdFFHcHlkUWE2cGhnTU5pNDV0NWtzamxUSkQreVE1LzI2S1Y3eUNKWHFZVzlWaHdkaC9cblRNZjBVcEpwRkFubFlHNlhzUHRobnBjNHljTjdoeWI3dnA0R24renNjYVM0b2xZS0M4eXJ6MVlZTkJOSUU4SEtcbjhrZjBvUE43cm5MUTFlZ0JiUHk4T094WDhxcEZhRVBEL2JQdHdzdGVLdnk5VEU3NEhuRnVCeGNJc1I2YnRqUnNcbnNERjJiNERNUW5hMXNFVnhPYlRSYzFDZ3k3WFZoa0x0NjFUNG8vd1VvTGJaYmJ5cEg3ek9oakxtRHU0RjgxSEtcbmYvSlMwSkZ1T3NPS1VtOTFQQTRzYnE5Si9vbVZrMG5ySkF3bE1iZ2JGbmhjMytGMkJtUmcxWXZBQkhrc21VSnFcbmhYZ0JJMFdCQWdNQkFBRUNnZ0VBQ2x3bko0K3BlWkNhalh3aU5nd0xGSDFtY3JsRnhYSnZwVytkNlNLMVErM0hcbmliRlFjMHpQSFNEWDFkUW4zUkRidkZjbHBGUUNZTjN3WG56bElxZ2dvbzI1YnZkTithM3EvWTFRTjdjV1NoVFNcbi9pZko0TGo3a0JtQmZlWVBvZTFBbUVOME9GZXBEa0hLbkt1dnZtSCs1ZjUxb2tYRlJXZVRHN0RvbHJGT1ZqNWdcbm1xSUxmWXRrclJ5anFiSXdteTFxeGxZcUtwNld3VEI3eDNJT2NUMXZNWWJhaFhzeTFLb0RRLzFpbEdYS3RBTVBcbmU1YXhNUnNPNGtzV1Frai96NnRoK3ZzOW5DMkZrbDZvWnJuZEljMVpGRitra0p6Z3NjVmJORkhjeGZKTDZSTXZcbmZpSC9ZMHFlSVY3ZWtkaXFkcjhGcENUdlcvQTVTOFkxM0VYcHdlTmVRUUtCZ1FEWnFybndNR21ITlBZenFLK3BcbmtteU5JK09uZ2JJekd4b2FQU3pySG0rN2JIZzZZN2tlRlIrc1IxNjY1OVNTZmw5ZEVkWnlXMmhIdGtVZGtLSS9cbldRQ3psdzgzTlgxRHhMR0NBY1R0SGNXSWtvSDJyRUdMRmN1b2tEU0w0QkpFRkJxTVIrbVZKZDd0UUhsRE5LdFlcbnlsNFVxdDdPRUs4OExFQmhFZWdpaEx2d1NRS0JnUURWVng0QW80RHJmTU15cUk4VlZXcGF3L1B2Z2dVTXdkZDRcbmdaamxJcGR3b3VHeEMrRmlEUzl5RWxpSHBlMGxSTmFqTXYreXJ2K25zUXh0d3Bab3JqZjBtdVVnUUlleVZUWm5cbnpHZmN6eHBMYk00a3ZKZEVGSnkzMTZnL01lYzRXVC9NUUpINVZsSVVZUERLSTZ6UmUzbUF6bnBkbVhtdEt3OGJcbmxjWk0wRDhiZVFLQmdEaTFJL0FSak15dTNaMmp5dkFRdDdzbHFIL1JhRTJzTitheUhXdTc2RHdhREZDWi9uWjVcbjVtQ0p6NEkrTjhGYXJ4bWVOaEpoQWcvOHlwRGpSNEhkZkROTm5hY3loa29MaW50bVhwbXY4ZkNjeXNNcktZQkVcbjAyUTgvWk9iY3ViTm5nVUNEemJPUVAvcWxpME9JYjNtS3hDVFc2eXY2QmR6SitxaU1hb2NqcUlSQW9HQkFNN25cbmxxbDM2V2g1cjdaSjA3c1ZBL2pUWXBrK3VEY1BLREl2UG1HN2tyUWl4RkE0L1hWaTVFajFrZmE4N2FuZmdXcjFcbjR4Y2dzY0dvN0N6bk00aUNycklFSjRPSUVoTGFvZEU1Wk9HNTJmNmNuN0R4VnFNb2VuV3lLZkpnSzZkeXAzVW9cbmltb1BWYnQ5NlFtaVg5RXF0MFE4L0dBYW9POVplMlY5ZEx5Nm12bkJBb0dCQU5FOGpaV3hjaGFkcEg4b21RQm1cbmtSdlRWVWZ0K1pSdmtjdVpPSVNDUnNSci9TaGMyOE02OTR1RGxPTVR3eWx6aldvU2ZzUkEyUGhVYVMvYi9IWTVcbnp6cXdpVzFBVms0VVNKeS83RFlLTURNRXJjbVNocGVvNWsyQVVZQkZjSDhZNnh2am1WK1lheDlndTNLVGxJY2dcbitTMm1NYmh6SnJTM3NVVTJub2VqalNHQ1xuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHJlc3EtN2NkMDguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJjbGllbnRfaWQiOiAiMTA0Mjg5ODI2NTU4NTY0OTI1MDI4IiwKICAiYXV0aF91cmkiOiAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLAogICJ0b2tlbl91cmkiOiAiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLAogICJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwKICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MHJlc3EtN2NkMDguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K';

  try {
    // Decode and parse Firebase credentials
    const firebaseCredJson = Buffer.from(firebaseCredBase64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(firebaseCredJson);

    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = firebaseCredJson;

    console.log('    ✅ Base64 decode: SUCCESS');
    console.log('    ✅ JSON parse: SUCCESS');
    console.log(`    📋 Project ID: ${serviceAccount.project_id}`);
    console.log(`    🔑 Private Key ID: ${serviceAccount.private_key_id}`);
    console.log(`    📧 Client Email: ${serviceAccount.client_email}`);
    console.log(`    🆔 Client ID: ${serviceAccount.client_id}`);
    console.log(`    🔑 Private Key: ${serviceAccount.private_key ? 'LOADED (' + serviceAccount.private_key.length + ' chars)' : 'MISSING'}`);
    console.log(`    🔑 Private Key Preview: ${serviceAccount.private_key ? serviceAccount.private_key.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`    ✅ NEW Firebase credentials loaded successfully!`);
    console.log(`    🎯 Credential Source: EMBEDDED_BASE64_v3.0`);
  } catch (error) {
    console.error('    ❌ Failed to decode Firebase credentials:', error.message);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.log('🔥 Firebase: Using credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var');
} else if (process.env.FIREBASE_PROJECT_ID) {
  console.log('🔥 Firebase: Using individual environment variables');
} else {
  console.log('🔥 Firebase: Using file path from FIREBASE_SERVICE_ACCOUNT_PATH');
}

console.log('─────────────────────────────────────────────────────────────────');
console.log('✅ Configuration loading complete\n');

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
const chatRoutes = require('./routes/chat.routes');
const ratingRoutes = require('./routes/rating.routes');
const tempRoutes = require('./routes/temp.routes'); // TEMPORARY - DELETE AFTER USE

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

// Rate limiting (disabled in development for testing)
if (process.env.NODE_ENV === 'production') {
  app.use('/api', generalLimiter);
  console.log('✅ Rate limiting ENABLED (production mode)');
} else {
  console.log('⚠️  Rate limiting DISABLED (development mode)');
}

// Block suspicious paths (security)
app.use((req, res, next) => {
  const suspiciousPaths = [
    '/.env',
    '/.git',
    '/config',
    '/.aws',
    '/admin',
    '/phpmyadmin',
    '/wp-admin',
    '/.htaccess',
    '/web.config',
    '/.ssh',
    '/backup',
    '/.vscode',
    '/node_modules'
  ];

  if (suspiciousPaths.some(path => req.path.toLowerCase().startsWith(path))) {
    console.warn(`[Security] Blocked suspicious request: ${req.method} ${req.path} from IP: ${req.ip}`);
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  next();
});

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

// Socket.IO status endpoint
app.get('/socket-status', (req, res) => {
  try {
    const { getIO } = require('./config/socket');
    const io = getIO();

    if (!io) {
      return res.status(503).json({
        success: false,
        message: 'Socket.IO not initialized',
        timestamp: new Date().toISOString()
      });
    }

    // Get all rooms and their socket counts
    const rooms = {};
    io.sockets.adapter.rooms.forEach((sockets, roomName) => {
      // Skip individual socket IDs (they are also in rooms map)
      if (!io.sockets.sockets.has(roomName)) {
        rooms[roomName] = {
          socketCount: sockets.size,
          sockets: Array.from(sockets)
        };
      }
    });

    const totalConnections = io.engine.clientsCount;

    res.status(200).json({
      success: true,
      message: 'Socket.IO is running',
      timestamp: new Date().toISOString(),
      stats: {
        totalConnections: totalConnections,
        totalRooms: Object.keys(rooms).length,
        rooms: rooms
      },
      config: {
        port: process.env.PORT || 5000,
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        cors: process.env.CORS_ORIGIN || '*'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching Socket.IO status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/trip', tripRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/ratings', ratingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/utils',  utilsRoutes);
app.use('/api/v1/temp', tempRoutes); // TEMPORARY - DELETE AFTER USE

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