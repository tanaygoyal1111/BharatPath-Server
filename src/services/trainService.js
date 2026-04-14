const { redisClient } = require('../config/redis');
const trainProvider = require('../providers/trainProvider');
const liveTrainProvider = require('../providers/liveTrainProvider');
const logger = require('../utils/logger');
const masterMap = require('../data/master_map.json');

class TrainService {
  constructor() {
    this.CACHE_TTL = 1800; // 30 minutes in seconds
    this.LIVE_CACHE_TTL = 60; // 60 seconds
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
    console.log(from,to,date ,"Provider");
    

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

  async getLiveTrainStatus(trainNumber) {
    const cacheKey = `train_live:v1:${trainNumber}`;
    const startTime = Date.now();

    // 1. Check Redis Cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info('⚡ CACHE_HIT');
        const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        parsed.source = "CACHE";
        // Do not update lastUpdated for cache reads
        return parsed;
      }
    } catch (err) {
      logger.error('Redis error in getLiveTrainStatus (Read)', err);
    }

    // 2. Fetch from Provider
    logger.info('🐢 API_MISS');
    let apiResponse;
    try {
      apiResponse = await liveTrainProvider.fetchLiveStatus(trainNumber);
    } catch (apiError) {
      // 3. Fallback Strategy
      logger.warn('API Error, 🔁 FALLBACK_TRIGGERED');
      try {
        const fallbackData = await redisClient.get(cacheKey);
        if (fallbackData) {
          const parsed = typeof fallbackData === 'string' ? JSON.parse(fallbackData) : fallbackData;
          parsed.source = "FALLBACK";
          return parsed;
        }
      } catch (err) {
        logger.error('Redis error in getLiveTrainStatus (Fallback)', err);
      }
      
      throw new Error("Unable to fetch live train status");
    }

    logger.info(`Request latency for API: ${Date.now() - startTime}ms`);

    // 4. Transform Data
    const d = apiResponse?.data || {};
    
    // Convert API times to ISO timestamps
    let isoTimestamp;
    try {
      // Prefer dateOfJourney initially
      if (d.dateOfJourney) {
         isoTimestamp = new Date(d.dateOfJourney).toISOString();
      } else {
         isoTimestamp = new Date().toISOString();
      }
    } catch {
      isoTimestamp = new Date().toISOString();
    }

    // 5. Enrichment
    const currStationCode = d.currentStation?.stationCode || '';
    const nextStationCode = d.nextStation?.stationCode || '';

    const currLat = masterMap[currStationCode]?.lat || null;
    const currLng = masterMap[currStationCode]?.lng || null;
    
    const nextLat = masterMap[nextStationCode]?.lat || null;
    const nextLng = masterMap[nextStationCode]?.lng || null;

    const transformedData = {
      trainNumber: String(trainNumber),
      trainName: d.trainName || "UNKNOWN",
      status: d.status || "SCHEDULED",
      delayInMinutes: d.delayInMinutes || 0,
      platform: d.platform || "TBA",
      lastUpdated: new Date().toISOString(),
      currentStation: {
        name: d.currentStation?.stationName || "UNKNOWN",
        code: currStationCode,
        lat: currLat,
        lng: currLng
      },
      nextStation: {
        name: d.nextStation?.stationName || "UNKNOWN",
        code: nextStationCode,
        lat: nextLat,
        lng: nextLng,
        distance: d.nextStation?.distance || 0,
        eta: d.nextStation?.eta || isoTimestamp
      },
      source: "API"
    };

    // 6. Save to Redis
    try {
      // We overwrite source back to CACHE before saving or keep as API?
      // Wait, we save the object as is, but when returning from cache we set source="CACHE".
      // Let's ensure we just save current state.
      await redisClient.set(cacheKey, JSON.stringify(transformedData), { ex: this.LIVE_CACHE_TTL });
    } catch (err) {
      logger.error('Redis set error in getLiveTrainStatus', err);
    }

    return transformedData;
  }
}

module.exports = new TrainService();
