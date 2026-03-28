const { redisClient } = require('../config/redis');
const trainProvider = require('../providers/trainProvider');
const logger = require('../utils/logger');

class TrainService {
  constructor() {
    this.CACHE_TTL = 1800; // 30 minutes in seconds
  }

  async searchTrains(from, to, date) {
    const cacheKey = `trains:v1:${from}:${to}:${date}`;

    // 1. Check Redis Cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info('⚡ CACHE HIT: Serving from Redis');
        return typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      }
    } catch (err) {
      logger.error('Redis error in TrainService', err);
    }

    // 2. Fetch from Provider
    logger.info('🐢 CACHE MISS: Fetching from provider');
    const trains = await trainProvider.fetchTrainsBetweenStations(from, to, date);

    // 3. Sort trains by departure time
    const sortedTrains = trains.sort((a, b) => {
      return a.departure.time.localeCompare(b.departure.time);
    });

    // 4. Store in Redis
    try {
      await redisClient.set(cacheKey, JSON.stringify(sortedTrains), { ex: this.CACHE_TTL });
    } catch (err) {
      logger.error('Redis set error in TrainService', err);
    }

    return sortedTrains;
  }
}

module.exports = new TrainService();
