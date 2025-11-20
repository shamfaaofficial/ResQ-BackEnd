/**
 * Socket.IO Driver Location Test
 * This script simulates a driver sending location updates and a user receiving them
 */

const io = require('socket.io-client');
const mongoose = require('mongoose');
require('dotenv').config();

// ANSI colors for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  driver: (msg) => console.log(`${colors.blue}🚗 [DRIVER] ${msg}${colors.reset}`),
  user: (msg) => console.log(`${colors.yellow}📱 [USER] ${msg}${colors.reset}`),
  location: (msg) => console.log(`${colors.green}📍 ${msg}${colors.reset}`),
};

async function testSocketLocationTracking() {
  try {
    log.info('Starting Socket.IO Location Tracking Test...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    log.success('Connected to MongoDB\n');

    const User = require('./src/models/User');
    const Driver = require('./src/models/Driver');
    const Booking = require('./src/models/Booking');
    const { generateAccessToken } = require('./src/utils/helpers');

    // Find or create test user and driver
    let user = await User.findOne({ role: 'user' });
    if (!user) {
      log.error('No user found in database. Please create a user first.');
      process.exit(1);
    }

    let driver = await Driver.findOne({}).populate('userId');
    if (!driver || !driver.userId) {
      log.error('No driver found in database. Please create a driver first.');
      process.exit(1);
    }

    log.success(`Found User: ${user.phoneNumber} (ID: ${user._id})`);
    log.success(`Found Driver: ${driver.userId.phoneNumber} (ID: ${driver.userId._id})\n`);

    // Create a test booking
    const booking = await Booking.create({
      bookingNumber: 'BK_SOCKET_TEST_' + Date.now(),
      userId: user._id,
      driverId: driver._id,
      status: 'payment_completed', // Active status
      vehicleType: 'sedan',
      pickupLocation: {
        type: 'Point',
        coordinates: [74.8413559, 12.9235599], // [lng, lat]
        address: 'Test Pickup Location'
      },
      dropoffLocation: {
        type: 'Point',
        coordinates: [74.8388112, 12.8854777],
        address: 'Test Dropoff Location'
      },
      distance: { estimated: 5 },
      pricing: {
        basePrice: 110,
        perKmRate: 10,
        totalDistance: 5,
        distancePrice: 50,
        serviceFee: 0,
        totalAmount: 160,
        currency: 'QAR'
      },
      payment: {
        status: 'completed',
        method: 'Test',
        paidAmount: 160,
        paidAt: new Date()
      },
      requestExpiresAt: new Date(Date.now() + 60000)
    });

    log.success(`Created test booking: ${booking.bookingNumber} (ID: ${booking._id})\n`);

    // Generate JWT tokens
    const userToken = generateAccessToken(user._id, 'user');
    const driverToken = generateAccessToken(driver.userId._id, 'driver');

    log.info('Generated JWT tokens\n');

    // Socket.IO Server URL - Use production server for testing
    const serverUrl = 'https://dev.resq-qa.com';

    log.info(`Connecting to Socket.IO server: ${serverUrl}\n`);

    // ==================== USER SOCKET ====================
    log.user('Connecting user socket...');
    const userSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: userToken },
      path: '/socket.io/',
      forceNew: true,
    });

    let locationUpdateReceived = false;

    userSocket.on('connect', () => {
      log.user(`Connected! Socket ID: ${userSocket.id}`);
    });

    userSocket.on('user:joined', (data) => {
      log.user(`Joined room: ${data.room}`);
    });

    userSocket.on('driver:location', (data) => {
      locationUpdateReceived = true;
      log.location('────────────────────────────────────────────');
      log.location('USER RECEIVED DRIVER LOCATION UPDATE!');
      log.location(`Booking ID: ${data.bookingId}`);
      log.location(`Latitude: ${data.latitude}`);
      log.location(`Longitude: ${data.longitude}`);
      log.location(`Timestamp: ${data.timestamp}`);
      log.location('────────────────────────────────────────────\n');
    });

    userSocket.on('connect_error', (error) => {
      log.error(`User socket connection error: ${error.message}`);
    });

    // ==================== DRIVER SOCKET ====================
    log.driver('Connecting driver socket...');
    const driverSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: driverToken },
      path: '/socket.io/',
      forceNew: true,
    });

    driverSocket.on('connect', () => {
      log.driver(`Connected! Socket ID: ${driverSocket.id}`);
    });

    driverSocket.on('driver:joined', (data) => {
      log.driver(`Joined room: ${data.room}\n`);
    });

    driverSocket.on('connect_error', (error) => {
      log.error(`Driver socket connection error: ${error.message}`);
    });

    driverSocket.on('error', (error) => {
      log.error(`Driver socket error: ${error.message}`);
    });

    // Wait for both sockets to connect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==================== SEND LOCATION UPDATES ====================
    log.info('Starting location update simulation...\n');

    // Simulate driver moving (5 location updates)
    const startLat = 12.9235599;
    const startLng = 74.8413559;

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const lat = startLat + (i * 0.001); // Move slightly
      const lng = startLng + (i * 0.001);

      log.driver(`Sending location update #${i + 1}...`);
      log.driver(`  Booking ID: ${booking._id}`);
      log.driver(`  Latitude: ${lat}`);
      log.driver(`  Longitude: ${lng}`);

      driverSocket.emit('driver:location:update', {
        bookingId: booking._id.toString(),
        latitude: lat,
        longitude: lng,
      });

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for broadcast
    }

    // Wait a bit for final updates
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==================== CLEANUP ====================
    log.info('\nCleaning up...');

    userSocket.disconnect();
    driverSocket.disconnect();
    log.info('Sockets disconnected');

    await Booking.deleteOne({ _id: booking._id });
    log.info('Test booking deleted');

    await mongoose.disconnect();
    log.info('MongoDB disconnected\n');

    // ==================== RESULTS ====================
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    if (locationUpdateReceived) {
      log.success('✅ TEST PASSED!');
      log.success('User successfully received driver location updates via Socket.IO');
      log.success('Real-time location tracking is working correctly!\n');
      process.exit(0);
    } else {
      log.error('❌ TEST FAILED!');
      log.error('User did NOT receive location updates');
      log.error('Check server logs and Socket.IO configuration\n');
      process.exit(1);
    }

  } catch (error) {
    log.error(`Test failed with error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testSocketLocationTracking();
