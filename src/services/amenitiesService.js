const { redisClient } = require('../config/redis');
const amenitiesProvider = require('../providers/amenitiesProvider');
const logger = require('../utils/logger');

/**
 * In-flight request deduplication map.
 * Prevents concurrent identical Overpass requests from hammering the API.
 * Key: cache key string, Value: Promise<result>
 */
const inFlight = new Map();

class AmenitiesService {
  constructor() {
    this.CACHE_TTL = 86400; // 24 hours
  }

  /**
  
   * @param {number} lat
   * @param {number} lng
   * @returns {{ hospitals: Array, hotels: Array, source: string }}
   */
  async getNearbyAmenities(lat, lng) {
  
    const roundedLat = parseFloat(lat).toFixed(3);
    const roundedLng = parseFloat(lng).toFixed(3);

    // ── 2. Redis Key ─────────────────────────────────────────
    const cacheKey = `amenities:v1:${roundedLat}:${roundedLng}`;

    // ── 3. Check Redis Cache ─────────────────────────────────
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`⚡ CACHE_HIT [amenities] (${roundedLat}, ${roundedLng})`);
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return { ...parsed, source: 'cache' };
      }
    } catch (err) {
      logger.error('[AmenitiesService] Redis read error:', err.message);
      // Continue — Redis down should not block the request
    }

    // ── 4. In-Flight Deduplication ───────────────────────────
    if (inFlight.has(cacheKey)) {
      logger.info(`🔄 DEDUP_HIT [amenities] Reusing in-flight for (${roundedLat}, ${roundedLng})`);
      try {
        const result = await inFlight.get(cacheKey);
        return { ...result, source: 'dedup' };
      } catch {
        return { hospitals: [], hotels: [], source: 'fallback' };
      }
    }

    // ── 5. Fetch from Overpass ────────────────────────────────
    logger.info(`🐢 CACHE_MISS [amenities] (${roundedLat}, ${roundedLng})`);

    const fetchPromise = this._fetchAndCache(cacheKey, roundedLat, roundedLng);
    inFlight.set(cacheKey, fetchPromise);

    try {
      const data = await fetchPromise;
      return { ...data, source: 'api' };
    } catch (err) {
      logger.error('[AmenitiesService] Fetch pipeline error:', err.message);
      return { hospitals: [], hotels: [], source: 'fallback' };
    } finally {
      inFlight.delete(cacheKey);
    }
  }

  /**
   * Fetch from Overpass provider and store in Redis.
   * Separated to enable clean in-flight deduplication.
   */
  async _fetchAndCache(cacheKey, lat, lng) {
    const data = await amenitiesProvider.fetchNearbyAmenities(
      parseFloat(lat),
      parseFloat(lng)
    );

    // Only cache if we got real results
    const totalItems = (data.hospitals?.length || 0) + (data.hotels?.length || 0);
    if (totalItems > 0) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: this.CACHE_TTL });
        logger.info(`💾 CACHED [amenities] (${lat}, ${lng}) — ${totalItems} items (TTL: 24h)`);
      } catch (err) {
        logger.error('[AmenitiesService] Redis write error:', err.message);
      }
    }

    return data;
  }
}

module.exports = new AmenitiesService();
