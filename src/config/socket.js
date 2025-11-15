const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');

let io;

/**
 * Initialize Socket.io server
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    // Important for production deployments
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    upgradeTimeout: 30000,

    // Timeouts
    pingTimeout: 60000,
    pingInterval: 25000,

    // Connection settings
    connectTimeout: 45000,

    // Path configuration
    path: '/socket.io/',

    // Engine.IO options
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: true,
    maxHttpBufferSize: 1e6,

    // Cookie settings (for sticky sessions if using load balancer)
    cookie: false,

    // Important for reverse proxies
    serveClient: false,

    // WebSocket options
    wsEngine: 'ws',

    // Destroy upgrade timeout
    destroyUpgrade: false,
    destroyUpgradeTimeout: 1000
  });

  console.log('✅ [Socket.io] Configuration:');
  console.log(`   Transports: websocket, polling`);
  console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`   Path: /socket.io/`);
  console.log(`   Allow Upgrades: true`);
  console.log(`   Upgrade Timeout: 30000ms`);
  console.log(`   Server Port: ${process.env.PORT || 5000}`);

  // Authentication middleware
  io.use(async (socket, next) => {
    const socketId = socket.id;
    const clientIp = socket.handshake.address;
    const transport = socket.conn.transport.name;

    console.log(`\n🔐 [Socket Auth] New connection attempt`);
    console.log(`   Socket ID: ${socketId}`);
    console.log(`   Client IP: ${clientIp}`);
    console.log(`   Transport: ${transport}`);
    console.log(`   Headers:`, JSON.stringify(socket.handshake.headers, null, 2));

    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log(`❌ [Socket Auth] Connection rejected - No token provided (${socketId})`);
        console.log(`   Auth object:`, JSON.stringify(socket.handshake.auth, null, 2));
        return next(new Error('Authentication token required'));
      }

      console.log(`🔑 [Socket Auth] Token received, verifying...`);
      console.log(`   Token preview: ${token.substring(0, 20)}...`);

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      console.log(`✅ [Socket Auth] Token verified successfully`);
      console.log(`   User ID: ${decoded.userId}`);
      console.log(`   Role: ${decoded.role}`);
      console.log(`   Token Expiry: ${new Date(decoded.exp * 1000).toISOString()}`);

      next();
    } catch (error) {
      console.log(`❌ [Socket Auth] Authentication failed - ${error.message} (${socketId})`);
      console.log(`   Error stack:`, error.stack);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const initialTransport = socket.conn.transport.name;

    console.log(`\n╔════════════════════════════════════════════════════════╗`);
    console.log(`║          🔌 NEW SOCKET CONNECTION                     ║`);
    console.log(`╚════════════════════════════════════════════════════════╝`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   User ID: ${socket.userId}`);
    console.log(`   Role: ${socket.userRole}`);
    console.log(`   Transport: ${initialTransport}`);
    console.log(`   Connected at: ${new Date().toISOString()}`);
    console.log(`   Total Connections: ${io.engine.clientsCount}`);

    // Monitor transport upgrades
    socket.conn.on('upgrade', (transport) => {
      console.log(`\n⬆️  [Socket Upgrade] Connection upgraded`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   From: ${initialTransport} → To: ${transport.name}`);
      console.log(`   User: ${socket.userId} (${socket.userRole})`);
    });

    // Monitor packet events for debugging
    socket.conn.on('packet', (packet) => {
      if (packet.type === 'ping' || packet.type === 'pong') return; // Skip ping/pong spam
      console.log(`📦 [Socket Packet] ${packet.type} - Socket: ${socket.id}`);
    });

    // Driver joins their personal room (automatic on connection)
    if (socket.userRole === 'driver') {
      socket.join(`driver:${socket.userId}`);
      console.log(`\n🚗 [Socket Room] Driver joined personal room (auto)`);
      console.log(`   Room: driver:${socket.userId}`);
      console.log(`   Driver ID: ${socket.userId}`);

      // Send confirmation back to driver
      socket.emit('driver:joined', {
        success: true,
        room: `driver:${socket.userId}`,
        socketId: socket.id,
        userId: socket.userId
      });
    }

    // User joins their personal room (automatic on connection)
    if (socket.userRole === 'user') {
      socket.join(`user:${socket.userId}`);
      console.log(`\n👤 [Socket Room] User joined personal room (auto)`);
      console.log(`   Room: user:${socket.userId}`);
      console.log(`   User ID: ${socket.userId}`);

      // Send confirmation back to user
      socket.emit('user:joined', {
        success: true,
        room: `user:${socket.userId}`,
        socketId: socket.id,
        userId: socket.userId
      });
    }

    // Handle explicit driver:join event (for manual room joining)
    socket.on('driver:join', async ({ driverId }) => {
      console.log(`\n🚪 [Socket Event] driver:join received`);
      console.log(`   Driver ID from event: ${driverId}`);
      console.log(`   Socket User ID: ${socket.userId}`);
      console.log(`   Socket ID: ${socket.id}`);

      // Verify the driverId matches the authenticated user
      if (socket.userRole !== 'driver') {
        console.log(`❌ [Socket] Join failed - User is not a driver (role: ${socket.userRole})`);
        socket.emit('driver:join:error', {
          success: false,
          message: 'Only drivers can join driver rooms'
        });
        return;
      }

      if (driverId !== socket.userId.toString()) {
        console.log(`❌ [Socket] Join failed - Driver ID mismatch (requested: ${driverId}, authenticated: ${socket.userId})`);
        socket.emit('driver:join:error', {
          success: false,
          message: 'Driver ID does not match authenticated user'
        });
        return;
      }

      // Join the driver to their room
      await socket.join(`driver:${driverId}`);

      console.log(`✅ [Socket Room] Driver ${driverId} joined room successfully (manual join)`);
      console.log(`   Room: driver:${driverId}`);
      console.log(`   Socket ID: ${socket.id}`);

      // Send confirmation back to driver
      socket.emit('driver:joined', {
        success: true,
        room: `driver:${driverId}`,
        socketId: socket.id,
        userId: driverId
      });

      console.log(`✅✅✅ DRIVER ROOM JOINED CONFIRMATION SENT ✅✅✅`);
    });

    // Driver sends real-time location during active trip
    socket.on('driver:location:update', async (data) => {
      console.log(`\n📍 [Socket Event] driver:location:update received`);
      console.log(`   From Driver: ${socket.userId}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { bookingId, latitude, longitude } = data;

        if (!bookingId || !latitude || !longitude) {
          console.log(`❌ [Socket] Location update failed - Missing required fields`);
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // Verify booking exists and driver is assigned
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          console.log(`❌ [Socket] Location update failed - Booking ${bookingId} not found`);
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        if (booking.driverId.toString() !== socket.userId.toString()) {
          console.log(`❌ [Socket] Location update failed - Unauthorized (Driver ${socket.userId} not assigned to booking)`);
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Only broadcast during active trip
        if (!['accepted', 'driver_arrived', 'in_progress'].includes(booking.status)) {
          console.log(`❌ [Socket] Location update failed - Invalid booking status: ${booking.status}`);
          socket.emit('error', { message: 'Booking is not in active state' });
          return;
        }

        // Broadcast location to user
        const locationData = {
          bookingId,
          latitude,
          longitude,
          timestamp: new Date()
        };

        io.to(`user:${booking.userId}`).emit('driver:location', locationData);

        console.log(`✅ [Socket] Location broadcasted successfully`);
        console.log(`   To User: ${booking.userId}`);
        console.log(`   Room: user:${booking.userId}`);
        console.log(`   Coordinates: [${latitude}, ${longitude}]`);

      } catch (error) {
        console.error(`❌ [Socket] Location update error:`, error.message);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Driver joins booking room
    socket.on('booking:join', async (bookingId) => {
      console.log(`\n📥 [Socket Event] booking:join received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Booking ID: ${bookingId}`);

      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          console.log(`❌ [Socket] Join failed - Booking ${bookingId} not found`);
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        // Verify user is part of booking
        const isDriver = booking.driverId && booking.driverId.toString() === socket.userId.toString();
        const isUser = booking.userId.toString() === socket.userId.toString();

        if (!isDriver && !isUser) {
          console.log(`❌ [Socket] Join failed - Unauthorized (not part of booking)`);
          socket.emit('error', { message: 'Unauthorized to join booking' });
          return;
        }

        socket.join(`booking:${bookingId}`);
        console.log(`✅ [Socket Room] ${socket.userRole} joined booking room successfully`);
        console.log(`   Room: booking:${bookingId}`);
        console.log(`   User: ${socket.userId}`);

        socket.emit('booking:joined', { bookingId });

      } catch (error) {
        console.error(`❌ [Socket] Booking join error:`, error.message);
        socket.emit('error', { message: 'Failed to join booking' });
      }
    });

    // User/Driver leaves booking room
    socket.on('booking:leave', (bookingId) => {
      console.log(`\n📤 [Socket Event] booking:leave received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Booking ID: ${bookingId}`);

      socket.leave(`booking:${bookingId}`);
      console.log(`✅ [Socket Room] Left booking:${bookingId}`);
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`\n╔════════════════════════════════════════════════════════╗`);
      console.log(`║          🔌 SOCKET DISCONNECTION                      ║`);
      console.log(`╚════════════════════════════════════════════════════════╝`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   User ID: ${socket.userId}`);
      console.log(`   Role: ${socket.userRole}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Disconnected at: ${new Date().toISOString()}`);
      console.log(`   Remaining Connections: ${io.engine.clientsCount}`);
    });
  });

  console.log('✅ [Socket.io] Server initialized');
  return io;
};

/**
 * Get Socket.io instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
};

/**
 * Emit booking status update to all parties
 */
const emitBookingUpdate = (booking) => {
  if (!io) {
    console.log(`⚠️  [Socket] Cannot emit booking update - Socket.io not initialized`);
    return;
  }

  const update = {
    bookingId: booking._id,
    status: booking.status,
    timeline: booking.timeline
  };

  console.log(`\n📢 [Socket Emit] booking:status:update`);
  console.log(`   Booking ID: ${booking._id}`);
  console.log(`   New Status: ${booking.status}`);
  console.log(`   User ID: ${booking.userId}`);
  console.log(`   Driver ID: ${booking.driverId || 'Not assigned'}`);

  // Emit to user
  io.to(`user:${booking.userId}`).emit('booking:status:update', update);
  console.log(`   ✅ Emitted to user room: user:${booking.userId}`);

  // Emit to driver if assigned
  if (booking.driverId) {
    io.to(`driver:${booking.driverId}`).emit('booking:status:update', update);
    console.log(`   ✅ Emitted to driver room: driver:${booking.driverId}`);
  }

  // Emit to booking room
  io.to(`booking:${booking._id}`).emit('booking:status:update', update);
  console.log(`   ✅ Emitted to booking room: booking:${booking._id}`);

  console.log(`   Payload:`, JSON.stringify(update, null, 2));
};

module.exports = {
  initializeSocket,
  getIO,
  emitBookingUpdate
};
