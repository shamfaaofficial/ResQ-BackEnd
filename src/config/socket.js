const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const chatService = require('../services/chat.service');

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

      // If user is a driver, fetch their driver profile to get the real Driver ID
      if (socket.userRole === 'driver') {
        try {
          const driver = await Driver.findOne({ userId: socket.userId });
          if (driver) {
            socket.driverId = driver._id;
            console.log(`   Driver Profile Found: ${driver._id}`);
          } else {
            console.log(`   ⚠️ Driver profile not found for user ${socket.userId}`);
          }
        } catch (err) {
          console.error(`   ❌ Error fetching driver profile: ${err.message}`);
        }
      }

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
    if (socket.userRole === 'driver' && socket.driverId) {
      socket.join(`driver:${socket.driverId}`);

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║  🚗 DRIVER AUTO-JOINED ROOM                                   ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(`   Driver ID: ${socket.driverId}`);
      console.log(`   Room Name: driver:${socket.driverId}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // Send confirmation back to driver
      const confirmationPayload = {
        success: true,
        room: `driver:${socket.driverId}`,
        socketId: socket.id,
        userId: socket.driverId,
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

      if (!socket.driverId || driverId !== socket.driverId.toString()) {
        console.log(`\n❌❌❌ MANUAL JOIN FAILED - ID MISMATCH ❌❌❌`);
        console.log(`   Requested Driver ID: ${driverId}`);
        console.log(`   Authenticated Driver ID: ${socket.driverId}`);
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

        if (!socket.driverId || booking.driverId.toString() !== socket.driverId.toString()) {
          console.log(`❌ [Socket] Location update failed - Unauthorized (Driver ${socket.driverId} not assigned to booking)`);
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
        const isDriver = booking.driverId && socket.driverId && booking.driverId.toString() === socket.driverId.toString();
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

    // =====================================================================
    // CHAT EVENT HANDLERS
    // =====================================================================

    // Join a chat room
    socket.on('chat:join', async (data, callback) => {
      console.log(`\n💬 [Socket Event] chat:join received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId } = data;

        // Determine participant ID
        const participantId = socket.userRole === 'driver' && socket.driverId
          ? socket.driverId
          : socket.userId;

        // Verify user has access to this chat
        const chat = await chatService.getChatById(chatId, participantId, socket.userRole);

        // Join the chat room
        socket.join(`chat:${chatId}`);

        console.log(`✅ [Socket Room] User joined chat successfully`);
        console.log(`   Room: chat:${chatId}`);
        console.log(`   User: ${socket.userId} (${socket.userRole})`);

        // Notify other participant
        socket.to(`chat:${chatId}`).emit('chat:user_joined', {
          chatId,
          userId: socket.userId,
          userRole: socket.userRole,
        });

        // Send success callback
        if (callback) {
          callback({
            success: true,
            chat,
          });
        }
      } catch (error) {
        console.error(`❌ [Socket] Chat join error:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // Leave a chat room
    socket.on('chat:leave', async (data) => {
      console.log(`\n💬 [Socket Event] chat:leave received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId } = data;

        socket.leave(`chat:${chatId}`);
        console.log(`✅ [Socket Room] Left chat:${chatId}`);

        // Notify other participant
        socket.to(`chat:${chatId}`).emit('chat:user_left', {
          chatId,
          userId: socket.userId,
        });
      } catch (error) {
        console.error(`❌ [Socket] Chat leave error:`, error.message);
      }
    });

    // Send message
    socket.on('chat:send_message', async (data, callback) => {
      console.log(`\n💬 [Socket Event] chat:send_message received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId, messageType, content, imageUrl, location } = data;

        // Determine participant ID
        const participantId = socket.userRole === 'driver' && socket.driverId
          ? socket.driverId
          : socket.userId;

        // Save message to database
        const message = await chatService.sendMessage(chatId, participantId, socket.userRole, {
          messageType: messageType || 'text',
          content,
          imageUrl,
          location,
        });

        // Emit message to chat room
        io.to(`chat:${chatId}`).emit('chat:new_message', {
          message,
        });

        // Get recipient ID and send notification
        const chat = await chatService.getChatById(chatId, socket.userId, socket.userRole);
        const recipientId = socket.userRole === 'user' ? chat.driverId._id : chat.userId._id;
        const recipientRole = socket.userRole === 'user' ? 'driver' : 'user';

        // Emit to recipient's personal room for notification badge update
        io.to(`${recipientRole}:${recipientId}`).emit('chat:new_message_notification', {
          chatId,
          message,
          unreadCount: socket.userRole === 'user' ? chat.unreadCountDriver : chat.unreadCountUser,
        });

        console.log(`✅ [Socket] Message sent successfully`);
        console.log(`   Chat ID: ${chatId}`);
        console.log(`   Message ID: ${message._id}`);
        console.log(`   Type: ${message.messageType}`);

        // Send success callback
        if (callback) {
          callback({
            success: true,
            message,
          });
        }
      } catch (error) {
        console.error(`❌ [Socket] Send message error:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // User is typing
    socket.on('chat:typing', async (data) => {
      console.log(`\n✍️  [Socket Event] chat:typing received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId } = data;

        // Broadcast to other users in the chat room
        socket.to(`chat:${chatId}`).emit('chat:user_typing', {
          chatId,
          userId: socket.userId,
          userRole: socket.userRole,
        });
      } catch (error) {
        console.error(`❌ [Socket] Typing event error:`, error.message);
      }
    });

    // User stopped typing
    socket.on('chat:stop_typing', async (data) => {
      console.log(`\n✋ [Socket Event] chat:stop_typing received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId } = data;

        // Broadcast to other users in the chat room
        socket.to(`chat:${chatId}`).emit('chat:user_stop_typing', {
          chatId,
          userId: socket.userId,
          userRole: socket.userRole,
        });
      } catch (error) {
        console.error(`❌ [Socket] Stop typing event error:`, error.message);
      }
    });

    // Message delivered
    socket.on('chat:message_delivered', async (data) => {
      console.log(`\n✓ [Socket Event] chat:message_delivered received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { messageId, chatId } = data;

        // Update message delivery status
        await chatService.markMessageAsDelivered(messageId);

        // Notify sender
        socket.to(`chat:${chatId}`).emit('chat:message_delivered_update', {
          messageId,
          deliveredAt: new Date(),
        });
      } catch (error) {
        console.error(`❌ [Socket] Message delivered error:`, error.message);
      }
    });

    // Messages read
    socket.on('chat:messages_read', async (data) => {
      console.log(`\n✓✓ [Socket Event] chat:messages_read received`);
      console.log(`   From: ${socket.userRole} ${socket.userId}`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));

      try {
        const { chatId } = data;

        // Determine participant ID
        const participantId = socket.userRole === 'driver' && socket.driverId
          ? socket.driverId
          : socket.userId;

        // Mark messages as read
        await chatService.markMessagesAsRead(chatId, participantId, socket.userRole);

        // Notify sender
        socket.to(`chat:${chatId}`).emit('chat:messages_read_update', {
          chatId,
          readBy: socket.userId,
          readAt: new Date(),
        });

        console.log(`✅ [Socket] Messages marked as read in chat ${chatId}`);
      } catch (error) {
        console.error(`❌ [Socket] Messages read error:`, error.message);
      }
    });

    // =====================================================================
    // END CHAT EVENT HANDLERS
    // =====================================================================

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
