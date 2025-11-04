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
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔌 [Socket] User connected: ${socket.userId} (${socket.userRole})`);

    // Driver joins their personal room
    if (socket.userRole === 'driver') {
      socket.join(`driver:${socket.userId}`);
      console.log(`🚗 [Socket] Driver ${socket.userId} joined personal room`);
    }

    // User joins their personal room
    if (socket.userRole === 'user') {
      socket.join(`user:${socket.userId}`);
      console.log(`👤 [Socket] User ${socket.userId} joined personal room`);
    }

    // Driver sends real-time location during active trip
    socket.on('driver:location:update', async (data) => {
      try {
        const { bookingId, latitude, longitude } = data;

        if (!bookingId || !latitude || !longitude) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // Verify booking exists and driver is assigned
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        if (booking.driverId.toString() !== socket.userId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Only broadcast during active trip
        if (!['accepted', 'driver_arrived', 'in_progress'].includes(booking.status)) {
          socket.emit('error', { message: 'Booking is not in active state' });
          return;
        }

        // Broadcast location to user
        io.to(`user:${booking.userId}`).emit('driver:location', {
          bookingId,
          latitude,
          longitude,
          timestamp: new Date()
        });

        console.log(`📍 [Socket] Driver ${socket.userId} location broadcasted to user ${booking.userId}`);

      } catch (error) {
        console.error('Error handling driver location update:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Driver joins booking room
    socket.on('booking:join', async (bookingId) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        // Verify user is part of booking
        const isDriver = booking.driverId && booking.driverId.toString() === socket.userId.toString();
        const isUser = booking.userId.toString() === socket.userId.toString();

        if (!isDriver && !isUser) {
          socket.emit('error', { message: 'Unauthorized to join booking' });
          return;
        }

        socket.join(`booking:${bookingId}`);
        console.log(`📦 [Socket] ${socket.userRole} ${socket.userId} joined booking:${bookingId}`);

        socket.emit('booking:joined', { bookingId });

      } catch (error) {
        console.error('Error joining booking room:', error);
        socket.emit('error', { message: 'Failed to join booking' });
      }
    });

    // User/Driver leaves booking room
    socket.on('booking:leave', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
      console.log(`📦 [Socket] ${socket.userRole} ${socket.userId} left booking:${bookingId}`);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`🔌 [Socket] User disconnected: ${socket.userId}`);
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
  if (!io) return;

  const update = {
    bookingId: booking._id,
    status: booking.status,
    timeline: booking.timeline
  };

  // Emit to user
  io.to(`user:${booking.userId}`).emit('booking:status:update', update);

  // Emit to driver if assigned
  if (booking.driverId) {
    io.to(`driver:${booking.driverId}`).emit('booking:status:update', update);
  }

  // Emit to booking room
  io.to(`booking:${booking._id}`).emit('booking:status:update', update);

  console.log(`📢 [Socket] Booking ${booking._id} status update emitted: ${booking.status}`);
};

module.exports = {
  initializeSocket,
  getIO,
  emitBookingUpdate
};
