const { Redis } = require('@upstash/redis');
const logger = require('../utils/logger');

let redisClient;

try {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  logger.info('Redis (Upstash REST) client initialized');
} catch (err) {
  logger.error('Failed to initialize Redis client', err);
}

// REST client doesn't need an explicit connect() call
const connectRedis = async () => {
  try {
    // We can do a simple ping to verify connection
    await redisClient.ping();
    logger.info('Redis (Upstash REST) connection verified');
  } catch (err) {
    logger.error('Redis (Upstash REST) verification failed', err);
  }
};

module.exports = { redisClient, connectRedis };
