const { getRedisClient, isRedisAvailable } = require('../config/redis');

/**
 * Redis Service - High-level Redis operations
 */

/**
 * Store driver location in Redis with geospatial indexing
 */
const storeDriverLocation = async (driverId, longitude, latitude, additionalData = {}) => {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();

    // Store in geospatial index for proximity queries
    await client.geoAdd('drivers:online:locations', {
      longitude: parseFloat(longitude),
      latitude: parseFloat(latitude),
      member: driverId.toString()
    });

    // Store detailed location data with expiry (5 minutes)
    const locationData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: Date.now(),
      ...additionalData
    };

    await client.setEx(
      `driver:location:${driverId}`,
      300, // 5 minutes expiry
      JSON.stringify(locationData)
    );

    // Track last update time for MongoDB sync
    await client.set(`driver:lastupdate:${driverId}`, Date.now().toString());

    return true;
  } catch (error) {
    console.error('[Redis Service] Error storing driver location:', error);
    return false;
  }
};

/**
 * Get driver location from Redis
 */
const getDriverLocation = async (driverId) => {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();
    const data = await client.get(`driver:location:${driverId}`);

    if (!data) return null;

    return JSON.parse(data);
  } catch (error) {
    console.error('[Redis Service] Error getting driver location:', error);
    return null;
  }
};

/**
 * Find nearby drivers using Redis geospatial queries
 */
const findNearbyDrivers = async (longitude, latitude, radiusKm = 10, limit = 20) => {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();

    // Search for drivers within radius
    const results = await client.geoSearch(
      'drivers:online:locations',
      { longitude: parseFloat(longitude), latitude: parseFloat(latitude) },
      { radius: radiusKm, unit: 'km' },
      {
        WITHDIST: true, // Include distance
        SORT: 'ASC', // Closest first
        COUNT: limit
      }
    );

    // Format results
    return results.map(result => ({
      driverId: result.member,
      distance: parseFloat(result.distance)
    }));
  } catch (error) {
    console.error('[Redis Service] Error finding nearby drivers:', error);
    return null;
  }
};

/**
 * Remove driver from online locations (when driver goes offline)
 */
const removeDriverLocation = async (driverId) => {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();

    // Remove from geospatial index
    await client.zRem('drivers:online:locations', driverId.toString());

    // Remove location data
    await client.del(`driver:location:${driverId}`);
    await client.del(`driver:lastupdate:${driverId}`);

    return true;
  } catch (error) {
    console.error('[Redis Service] Error removing driver location:', error);
    return false;
  }
};

/**
 * Cache active booking for driver
 */
const cacheActiveBooking = async (driverId, bookingId, expirySeconds = 7200) => {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();
    await client.setEx(
      `driver:booking:${driverId}`,
      expirySeconds,
      bookingId.toString()
    );
    return true;
  } catch (error) {
    console.error('[Redis Service] Error caching active booking:', error);
    return false;
  }
};

/**
 * Get cached active booking for driver
 */
const getActiveBooking = async (driverId) => {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();
    const bookingId = await client.get(`driver:booking:${driverId}`);
    return bookingId;
  } catch (error) {
    console.error('[Redis Service] Error getting active booking:', error);
    return null;
  }
};

/**
 * Remove active booking cache
 */
const removeActiveBooking = async (driverId) => {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();
    await client.del(`driver:booking:${driverId}`);
    return true;
  } catch (error) {
    console.error('[Redis Service] Error removing active booking:', error);
    return false;
  }
};

/**
 * Get count of online drivers
 */
const getOnlineDriversCount = async () => {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();
    const count = await client.zCard('drivers:online:locations');
    return count;
  } catch (error) {
    console.error('[Redis Service] Error getting online drivers count:', error);
    return null;
  }
};

/**
 * Check if driver needs MongoDB sync (last update > 5 minutes ago)
 */
const shouldSyncToMongoDB = async (driverId) => {
  if (!isRedisAvailable()) return true; // If Redis unavailable, always sync to MongoDB

  try {
    const client = getRedisClient();
    const lastUpdate = await client.get(`driver:lastupdate:${driverId}`);

    if (!lastUpdate) return true;

    const timeSinceUpdate = Date.now() - parseInt(lastUpdate);
    return timeSinceUpdate > 300000; // 5 minutes
  } catch (error) {
    console.error('[Redis Service] Error checking sync status:', error);
    return true;
  }
};

/**
 * Get all online driver IDs
 */
const getAllOnlineDriverIds = async () => {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();
    const drivers = await client.zRange('drivers:online:locations', 0, -1);
    return drivers;
  } catch (error) {
    console.error('[Redis Service] Error getting all online drivers:', error);
    return null;
  }
};

module.exports = {
  storeDriverLocation,
  getDriverLocation,
  findNearbyDrivers,
  removeDriverLocation,
  cacheActiveBooking,
  getActiveBooking,
  removeActiveBooking,
  clearActiveBooking: removeActiveBooking, // Alias for removeActiveBooking
  getOnlineDriversCount,
  shouldSyncToMongoDB,
  getAllOnlineDriverIds
};
