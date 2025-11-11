const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');

let io;

/**
 * Initialize Socket.IO server
 * @param {Object} httpServer - HTTP server instance
 */
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Fetch user or driver based on role
      let user;
      if (decoded.role === 'driver') {
        user = await Driver.findById(decoded.userId);
      } else {
        user = await User.findById(decoded.userId);
      }

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Handle driver joining booking room
    socket.on('join_booking', (bookingId) => {
      socket.join(`booking:${bookingId}`);
      console.log(`${socket.userRole} ${socket.userId} joined booking:${bookingId}`);
    });

    // Handle driver leaving booking room
    socket.on('leave_booking', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
      console.log(`${socket.userRole} ${socket.userId} left booking:${bookingId}`);
    });

    // Handle driver location updates (real-time)
    socket.on('driver_location_update', (data) => {
      if (socket.userRole === 'driver' && data.bookingId) {
        // Broadcast to all users in this booking room
        socket.to(`booking:${data.bookingId}`).emit('driver_location_changed', {
          location: data.location,
          timestamp: new Date(),
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit event to specific user
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit event to specific booking room
 * @param {String} bookingId - Booking ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToBooking = (bookingId, event, data) => {
  if (io) {
    io.to(`booking:${bookingId}`).emit(event, data);
  }
};

/**
 * Notify user about booking status change
 * @param {String} userId - User ID
 * @param {Object} booking - Booking object
 */
const notifyBookingStatusChange = (userId, booking) => {
  emitToUser(userId, 'booking_status_changed', {
    bookingId: booking._id,
    status: booking.status,
    timeline: booking.timeline,
    timestamp: new Date(),
  });
};

/**
 * Notify driver about booking status change
 * @param {String} driverId - Driver ID
 * @param {Object} booking - Booking object
 */
const notifyDriverBookingUpdate = (driverId, booking) => {
  emitToUser(driverId, 'booking_status_changed', {
    bookingId: booking._id,
    status: booking.status,
    timeline: booking.timeline,
    timestamp: new Date(),
  });
};

/**
 * Broadcast driver location update to booking room
 * @param {String} bookingId - Booking ID
 * @param {Object} location - Location data
 * @param {Object} eta - ETA data
 */
const broadcastDriverLocation = (bookingId, location, eta) => {
  emitToBooking(bookingId, 'driver_location_update', {
    location,
    eta,
    timestamp: new Date(),
  });
};

/**
 * Notify about driver arrival
 * @param {String} userId - User ID
 * @param {String} bookingId - Booking ID
 * @param {Object} driver - Driver data
 */
const notifyDriverArrival = (userId, bookingId, driver) => {
  emitToUser(userId, 'driver_arrived', {
    bookingId,
    driver: {
      name: driver.username,
      phone: driver.phoneNumber,
      vehicleDetails: driver.vehicleDetails,
    },
    timestamp: new Date(),
  });
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToBooking,
  notifyBookingStatusChange,
  notifyDriverBookingUpdate,
  broadcastDriverLocation,
  notifyDriverArrival,
};
