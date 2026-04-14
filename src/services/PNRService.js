const { redisClient } = require('../config/redis');
const railwayProvider = require('../providers/RailwayProvider');
const logger = require('../utils/logger');
const masterMap = require('../data/master_map.json');

class PNRService {
  constructor() {
    this.CACHE_TTL = 900; // 15 minutes (900 seconds)
  }

  async getPNRStatus(pnr) {
    const cacheKey = `pnr:${pnr}`;
    let cachedData = null;

    // 1. Try Redis Cache
    try {
      const data = await redisClient.get(cacheKey);
      if (data) {
        cachedData = typeof data === 'string' ? JSON.parse(data) : data;
        logger.info(`⚡ CACHE HIT for PNR: ${pnr}`);
        return cachedData; // Already normalized when it was cached
      }
    } catch (err) {
      logger.error(`Redis get error for PNR ${pnr}:`, err);
    }

    // 2. Fetch from Provider
    try {
      logger.info(`🐢 CACHE MISS for PNR: ${pnr}`);

      const rawData = await railwayProvider.getPNRStatus(pnr);

      // If the provider returned a sandbox object, skip normalization
      let normalizedData;
      if (rawData.__sandbox) {
        const { __sandbox, ...cleanData } = rawData;
        normalizedData = cleanData;
      } else {
        normalizedData = this._normalizePNR(rawData);
      }

      // 3. Cache in Redis (background, non-blocking)
      redisClient.set(cacheKey, JSON.stringify(normalizedData), { ex: this.CACHE_TTL })
        .then(() => logger.info(`💾 CACHED PNR: ${pnr} (TTL: ${this.CACHE_TTL}s)`))
        .catch(err => logger.error(`Redis set error for PNR ${pnr}:`, err));

      return normalizedData;
    } catch (err) {
      // 4. Fallback to stale cache on API failure
      if (cachedData) {
        logger.warn(`API failure for PNR: ${pnr}, falling back to cached data`);
        return cachedData;
      }

      logger.error(`API failure for PNR: ${pnr} and no cached data available`);
      throw err;
    }
  }

  /**
   * Normalizes the raw RapidAPI PNR response to the exact frontend schema.
   */
  _normalizePNR(raw) {
    // Enrich station names from master_map if available
    const sourceCode = raw.from_station || raw.sourceStation;
    const destCode = raw.to_station || raw.destinationStation;
    const sourceCity = masterMap[sourceCode]?.name || sourceCode;
    const destCity = masterMap[destCode]?.name || destCode;

    const departs = new Date(raw.dateOfJourney || raw.departureTime || new Date()).toISOString();
    const arrival = new Date(raw.arrivalDate || raw.arrivalTime || new Date()).toISOString();

    return {
      pnr: raw.pnrNumber || raw.pnr,
      trainNo: raw.trainNumber || raw.trainNo,
      trainName: raw.trainName,
      sourceCode: sourceCode,
      sourceCity: sourceCity,
      destCode: destCode,
      destCity: destCity,
      departs: new Date(raw.dateOfJourney || raw.departureTime || new Date()).toISOString(),
      arrival: new Date(raw.arrivalDate || raw.arrivalTime || new Date()).toISOString(),
      platform: 'TBA',
      coach: raw.passengerList?.[0]?.currentCoachId || raw.passengerList?.[0]?.bookingCoachId || 'WL',
      seat: raw.passengerList?.[0]?.currentBerthNo || raw.passengerList?.[0]?.bookingBerthNo || 'WL',
      statusTag: raw.passengerList?.[0]?.currentStatus || raw.chartStatus,
      subText: raw.passengerList?.[0]?.currentStatusDetails || 'Chart Not Prepared',
      currentLocation: null,
      eta: null,
      progressPct: 0,
    };
  }
}

module.exports = new PNRService();
