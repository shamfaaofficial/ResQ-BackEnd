// Import the Socket.IO instance from config/socket.js
const { getIO: getSocketIO } = require('../config/socket');

/**
 * Get Socket.IO instance from config
 */
const getIO = () => {
  try {
    return getSocketIO();
  } catch (error) {
    console.log(`⚠️  [Socket Service] Socket.io not initialized yet`);
    return null;
  }
};

/**
 * Emit event to specific user
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToUser = (userId, event, data) => {
  const io = getIO();

  if (!io) {
    console.log(`⚠️  [Socket Service] Cannot emit - Socket.io not initialized`);
    console.log(`   Target User: ${userId}`);
    console.log(`   Event: ${event}`);
    return;
  }

  console.log(`\n📤 [Socket Service] Emitting event to user`);
  console.log(`   Event: ${event}`);
  console.log(`   Target User ID: ${userId}`);
  console.log(`   Target Room: user:${userId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Payload:`, JSON.stringify(data, null, 2));

  io.to(`user:${userId}`).emit(event, data);

  console.log(`   ✅ Event emitted successfully`);
};

/**
 * Emit event to specific driver
 * @param {String} driverId - Driver ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToDriver = (driverId, event, data) => {
  const io = getIO();

  if (!io) {
    console.log(`⚠️  [Socket Service] Cannot emit - Socket.io not initialized`);
    console.log(`   Target Driver: ${driverId}`);
    console.log(`   Event: ${event}`);
    return;
  }

  console.log(`\n📤 [Socket Service] Emitting event to driver`);
  console.log(`   Event: ${event}`);
  console.log(`   Target Driver ID: ${driverId}`);
  console.log(`   Target Room: driver:${driverId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Payload:`, JSON.stringify(data, null, 2));

  io.to(`driver:${driverId}`).emit(event, data);

  console.log(`   ✅ Event emitted successfully to driver room`);
};

/**
 * Emit event to specific booking room
 * @param {String} bookingId - Booking ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToBooking = (bookingId, event, data) => {
  const io = getIO();

  if (!io) {
    console.log(`⚠️  [Socket Service] Cannot emit - Socket.io not initialized`);
    console.log(`   Target Booking: ${bookingId}`);
    console.log(`   Event: ${event}`);
    return;
  }

  console.log(`\n📤 [Socket Service] Emitting event to booking room`);
  console.log(`   Event: ${event}`);
  console.log(`   Target Booking ID: ${bookingId}`);
  console.log(`   Target Room: booking:${bookingId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Payload:`, JSON.stringify(data, null, 2));

  io.to(`booking:${bookingId}`).emit(event, data);

  console.log(`   ✅ Event emitted successfully`);
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

/**
 * Emit new booking request to driver
 * @param {String} driverId - Driver ID
 * @param {Object} bookingData - Booking data
 */
const emitNewBookingRequest = (driverId, bookingData) => {
  const io = getIO();

  if (!io) {
    console.log(`⚠️  [Socket Service] Cannot emit booking request - Socket.io not initialized`);
    console.log(`   Target Driver: ${driverId}`);
    return;
  }

  console.log(`\n🚨🚨🚨 [Socket Service] EMITTING NEW BOOKING REQUEST TO DRIVER 🚨🚨🚨`);
  console.log(`   Event: booking:new:request`);
  console.log(`   Target Driver ID: ${driverId}`);
  console.log(`   Target Room: driver:${driverId}`);
  console.log(`   Booking ID: ${bookingData.bookingId}`);
  console.log(`   Booking Number: ${bookingData.bookingNumber}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Payload:`, JSON.stringify(bookingData, null, 2));

  io.to(`driver:${driverId}`).emit('booking:new:request', bookingData);

  console.log(`   ✅✅✅ BOOKING REQUEST EMITTED SUCCESSFULLY TO driver:${driverId} ✅✅✅`);
};

module.exports = {
  getIO,
  emitToUser,
  emitToDriver,
  emitToBooking,
  notifyBookingStatusChange,
  notifyDriverBookingUpdate,
  broadcastDriverLocation,
  notifyDriverArrival,
  emitNewBookingRequest,
};
