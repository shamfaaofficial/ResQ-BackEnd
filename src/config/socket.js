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

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🔌 SOCKET.IO SERVER INITIALIZATION                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('✅ [Socket.io] Configuration:');
  console.log(`   Transports: websocket, polling`);
  console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`   Path: /socket.io/`);
  console.log(`   Allow Upgrades: true`);
  console.log(`   Upgrade Timeout: 30000ms`);
  console.log(`   Server Port: ${process.env.PORT || 5000}`);
  console.log(`   Node Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Authentication middleware
  io.use(async (socket, next) => {
    const socketId = socket.id;
    const clientIp = socket.handshake.address;
    const transport = socket.conn.transport.name;
    const timestamp = new Date().toISOString();

    console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  🔐 SOCKET AUTH ATTEMPT - ${timestamp}  ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);
    console.log(`📊 Connection Details:`);
    console.log(`   Socket ID: ${socketId}`);
    console.log(`   Client IP: ${clientIp}`);
    console.log(`   Transport: ${transport}`);
    console.log(`   URL: ${socket.handshake.url}`);
    console.log(`   Query:`, JSON.stringify(socket.handshake.query, null, 2));
    console.log(`\n🌐 Request Headers:`);
    console.log(`   Host: ${socket.handshake.headers.host || 'NOT_PROVIDED'}`);
    console.log(`   Origin: ${socket.handshake.headers.origin || 'NOT_PROVIDED'}`);
    console.log(`   User-Agent: ${socket.handshake.headers['user-agent'] || 'NOT_PROVIDED'}`);
    console.log(`   X-Forwarded-For: ${socket.handshake.headers['x-forwarded-for'] || 'NOT_PROVIDED'}`);
    console.log(`   X-Real-IP: ${socket.handshake.headers['x-real-ip'] || 'NOT_PROVIDED'}`);

    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log(`\n❌❌❌ AUTH FAILED - NO TOKEN PROVIDED ❌❌❌`);
        console.log(`   Socket ID: ${socketId}`);
        console.log(`   Auth object:`, JSON.stringify(socket.handshake.auth, null, 2));
        console.log(`   This means the frontend is NOT sending the JWT token!`);
        console.log(`═══════════════════════════════════════════════════════════════\n`);
        return next(new Error('Authentication token required'));
      }

      console.log(`\n🔑 Token Authentication:`);
      console.log(`   Token received: YES`);
      console.log(`   Token preview: ${token.substring(0, 30)}...`);
      console.log(`   Token length: ${token.length} characters`);
      console.log(`   Verifying token...`);

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      console.log(`\n✅✅✅ AUTH SUCCESS ✅✅✅`);
      console.log(`   User ID: ${decoded.userId}`);
      console.log(`   Role: ${decoded.role}`);
      console.log(`   Token Issued: ${new Date(decoded.iat * 1000).toISOString()}`);
      console.log(`   Token Expiry: ${new Date(decoded.exp * 1000).toISOString()}`);
      console.log(`   Time until expiry: ${Math.floor((decoded.exp * 1000 - Date.now()) / 1000 / 60)} minutes`);
      console.log(`═══════════════════════════════════════════════════════════════\n`);

      next();
    } catch (error) {
      console.log(`\n❌❌❌ AUTH FAILED - TOKEN VERIFICATION ERROR ❌❌❌`);
      console.log(`   Socket ID: ${socketId}`);
      console.log(`   Error Type: ${error.name}`);
      console.log(`   Error Message: ${error.message}`);
      console.log(`   Error Stack:`);
      console.log(error.stack);
      console.log(`═══════════════════════════════════════════════════════════════\n`);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const initialTransport = socket.conn.transport.name;
    const timestamp = new Date().toISOString();

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ✅ SOCKET CONNECTION ESTABLISHED - ${timestamp}  ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);
    console.log(`📊 Connection Info:`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   User ID: ${socket.userId}`);
    console.log(`   Role: ${socket.userRole.toUpperCase()}`);
    console.log(`   Transport: ${initialTransport.toUpperCase()}`);
    console.log(`   Client IP: ${socket.handshake.address}`);
    console.log(`   Connected at: ${timestamp}`);
    console.log(`   Total Active Connections: ${io.engine.clientsCount}`);
    console.log(`════════════════════════════════════════════════════════════════\n`);

    // Monitor transport upgrades
    socket.conn.on('upgrade', (transport) => {
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  ⬆️  TRANSPORT UPGRADE SUCCESSFUL                             ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   User: ${socket.userId} (${socket.userRole})`);
      console.log(`   From: ${initialTransport.toUpperCase()} → To: ${transport.name.toUpperCase()}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log(`   ✅ WebSocket connection now active!`);
      console.log(`════════════════════════════════════════════════════════════════\n`);
    });

    // Monitor transport upgrade errors
    socket.conn.on('upgradeError', (error) => {
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  ❌ TRANSPORT UPGRADE FAILED                                  ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   User: ${socket.userId} (${socket.userRole})`);
      console.log(`   Transport: ${initialTransport}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log(`   ⚠️ Staying on polling transport`);
      console.log(`════════════════════════════════════════════════════════════════\n`);
    });

    // Monitor packet events for debugging (reduced spam)
    let packetCount = 0;
    socket.conn.on('packet', (packet) => {
      if (packet.type === 'ping' || packet.type === 'pong') return; // Skip ping/pong spam
      packetCount++;
      console.log(`📦 [Packet #${packetCount}] Type: ${packet.type} | Socket: ${socket.id} | User: ${socket.userId}`);
    });

    // Driver joins their personal room (automatic on connection)
    if (socket.userRole === 'driver') {
      socket.join(`driver:${socket.userId}`);

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  🚗 DRIVER AUTO-JOINED ROOM                                   ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   Driver ID: ${socket.userId}`);
      console.log(`   Room Name: driver:${socket.userId}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // Send confirmation back to driver
      const confirmationPayload = {
        success: true,
        room: `driver:${socket.userId}`,
        socketId: socket.id,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      };

      socket.emit('driver:joined', confirmationPayload);

      console.log(`   ✅ Confirmation event 'driver:joined' emitted to driver`);
      console.log(`   Payload:`, JSON.stringify(confirmationPayload, null, 2));
      console.log(`════════════════════════════════════════════════════════════════\n`);
    }

    // User joins their personal room (automatic on connection)
    if (socket.userRole === 'user') {
      socket.join(`user:${socket.userId}`);

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  👤 USER AUTO-JOINED ROOM                                     ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   User ID: ${socket.userId}`);
      console.log(`   Room Name: user:${socket.userId}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // Send confirmation back to user
      const confirmationPayload = {
        success: true,
        room: `user:${socket.userId}`,
        socketId: socket.id,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      };

      socket.emit('user:joined', confirmationPayload);

      console.log(`   ✅ Confirmation event 'user:joined' emitted to user`);
      console.log(`   Payload:`, JSON.stringify(confirmationPayload, null, 2));
      console.log(`════════════════════════════════════════════════════════════════\n`);
    }

    // Handle explicit driver:join event (for manual room joining)
    socket.on('driver:join', async ({ driverId }) => {
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  🚪 MANUAL DRIVER:JOIN EVENT RECEIVED                        ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   Driver ID from event: ${driverId}`);
      console.log(`   Authenticated User ID: ${socket.userId}`);
      console.log(`   Authenticated Role: ${socket.userRole}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // Verify the driverId matches the authenticated user
      if (socket.userRole !== 'driver') {
        console.log(`\n❌❌❌ MANUAL JOIN FAILED - NOT A DRIVER ❌❌❌`);
        console.log(`   User Role: ${socket.userRole}`);
        console.log(`   Only drivers can join driver rooms`);
        console.log(`════════════════════════════════════════════════════════════════\n`);

        socket.emit('driver:join:error', {
          success: false,
          message: 'Only drivers can join driver rooms',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (driverId !== socket.userId.toString()) {
        console.log(`\n❌❌❌ MANUAL JOIN FAILED - ID MISMATCH ❌❌❌`);
        console.log(`   Requested Driver ID: ${driverId}`);
        console.log(`   Authenticated User ID: ${socket.userId}`);
        console.log(`   Security violation: Driver trying to join another driver's room`);
        console.log(`════════════════════════════════════════════════════════════════\n`);

        socket.emit('driver:join:error', {
          success: false,
          message: 'Driver ID does not match authenticated user',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Join the driver to their room (they should already be joined, but ensuring it)
      await socket.join(`driver:${driverId}`);

      console.log(`\n✅✅✅ MANUAL DRIVER JOIN SUCCESSFUL ✅✅✅`);
      console.log(`   Driver ID: ${driverId}`);
      console.log(`   Room: driver:${driverId}`);
      console.log(`   Socket ID: ${socket.id}`);

      // Send confirmation back to driver
      const confirmationPayload = {
        success: true,
        room: `driver:${driverId}`,
        socketId: socket.id,
        userId: driverId,
        timestamp: new Date().toISOString()
      };

      socket.emit('driver:joined', confirmationPayload);

      console.log(`   ✅ Confirmation event 'driver:joined' emitted`);
      console.log(`   Payload:`, JSON.stringify(confirmationPayload, null, 2));
      console.log(`════════════════════════════════════════════════════════════════\n`);
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
