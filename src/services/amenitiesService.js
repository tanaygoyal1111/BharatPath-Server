const { redisClient } = require('../config/redis');
const amenitiesProvider = require('../providers/amenitiesProvider');
const logger = require('../utils/logger');

/**
 * In-flight request deduplication map.
 * Prevents concurrent identical Overpass requests from hammering the API.
 * Key: cache key string, Value: Promise<result>
 */
const inFlightRequests = new Map();

class AmenitiesService {
  constructor() {
    this.CACHE_TTL = 86400; // 24 hours — static geographic data
    this.CACHE_PREFIX = 'amenities:v1';
  }

  /**
   * Get nearby amenities for coordinates.
   * Cache-Aside Pattern with 24h TTL and in-flight request deduplication.
   *
   * 1. Round lat/lng to 3 decimal places (grid snapping for better cache hits)
   * 2. Check Redis
   * 3. If miss → deduplicate concurrent requests → fetch from Overpass → cache
   * 4. On Overpass failure → return stale cache or empty
   */
  async getNearbyAmenities(lat, lng) {
    // ── Grid Snapping: 3 decimal places ≈ ~111m precision ──
    const roundedLat = parseFloat(lat).toFixed(3);
    const roundedLng = parseFloat(lng).toFixed(3);
    const cacheKey = `${this.CACHE_PREFIX}:${roundedLat}:${roundedLng}`;

    // ── 1. Check Redis Cache ──────────────────────────────
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`⚡ CACHE_HIT [amenities] (${roundedLat}, ${roundedLng})`);
        const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        return { amenities: parsed, source: 'cache' };
      }
    } catch (err) {
      logger.error('Redis read error in AmenitiesService:', err);
    }

    // ── 2. In-Flight Request Deduplication ────────────────
    // Critical: prevents Overpass API abuse under concurrent load
    if (inFlightRequests.has(cacheKey)) {
      logger.info(`🔄 DEDUP_HIT [amenities] Reusing in-flight request for (${roundedLat}, ${roundedLng})`);
      try {
        const result = await inFlightRequests.get(cacheKey);
        return { amenities: result, source: 'api' };
      } catch (err) {
        logger.error('In-flight dedup error:', err);
        return { amenities: [], source: 'fallback', message: 'Amenities temporarily unavailable' };
      }
    }

    // ── 3. Fetch from Overpass API ────────────────────────
    logger.info(`🐢 CACHE_MISS [amenities] (${roundedLat}, ${roundedLng})`);

    const fetchPromise = this._fetchAndCache(cacheKey, roundedLat, roundedLng);
    inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const amenities = await fetchPromise;
      return { amenities, source: 'api' };
    } catch (err) {
      logger.error('Amenities fetch pipeline error:', err);
      return { amenities: [], source: 'fallback', message: 'Amenities temporarily unavailable' };
    } finally {
      // Always clean up the in-flight entry
      inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Fetch from provider and cache the result.
   * Separated to enable clean deduplication.
   */
  async _fetchAndCache(cacheKey, lat, lng) {
    const amenities = await amenitiesProvider.fetchNearbyAmenities(
      parseFloat(lat),
      parseFloat(lng)
    );

    // ── 4. Store in Redis (24h TTL) ───────────────────────
    if (amenities && amenities.length > 0) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(amenities), { ex: this.CACHE_TTL });
        logger.info(`💾 CACHED [amenities] (${lat}, ${lng}) — ${amenities.length} items (TTL: 24h)`);
      } catch (err) {
        logger.error('Redis set error in AmenitiesService:', err);
      }
    }

    return amenities;
  }
}

module.exports = new AmenitiesService();
