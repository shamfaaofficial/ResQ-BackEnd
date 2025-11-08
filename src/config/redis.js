const redis = require('redis');

let redisClient = null;

/**
 * Initialize Redis connection
 */
const connectRedis = async () => {
  try {
    // Create Redis client
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ [Redis] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, etc.
          return Math.min(retries * 50, 3000);
        }
      }
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('🔗 [Redis] Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ [Redis] Connected and ready');
    });

    redisClient.on('error', (err) => {
      console.error('❌ [Redis] Error:', err.message);
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 [Redis] Reconnecting...');
    });

    redisClient.on('end', () => {
      console.log('🔌 [Redis] Connection closed');
    });

    // Connect to Redis
    await redisClient.connect();

    return redisClient;
  } catch (error) {
    console.error('❌ [Redis] Failed to connect:', error.message);
    console.warn('⚠️  [Redis] Continuing without Redis. Some features may be degraded.');
    // Don't throw error - app should work without Redis (degraded mode)
    return null;
  }
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    console.warn('⚠️  [Redis] Client not available');
    return null;
  }
  return redisClient;
};

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => {
  return redisClient && redisClient.isOpen;
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('✅ [Redis] Connection closed gracefully');
  }
};

/**
 * Graceful shutdown handler
 */
process.on('SIGINT', async () => {
  await closeRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeRedis();
  process.exit(0);
});

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisAvailable,
  closeRedis
};
