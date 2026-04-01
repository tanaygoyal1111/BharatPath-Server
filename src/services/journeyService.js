const { redisClient } = require('../config/redis');
const journeyProvider = require('../providers/journeyProvider');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class JourneyService {
  constructor() {
    this.CACHE_TTL = 60; // 60 seconds — live data
    this.CACHE_PREFIX = 'journey:v1';
  }

  /**
   * Get live journey data for a PNR.
   * Cache-Aside Pattern:
   *   1. Check Redis (60s TTL)
   *   2. If miss → fetch from provider → cache → return
   *   3. If API fails → return stale cache as fallback
   *   4. Fire-and-forget Supabase upsert for persistence
   */
  async getJourneyData(pnr, userId) {
    const cacheKey = `${this.CACHE_PREFIX}:${pnr}`;

    // ── 1. Check Redis Cache ──────────────────────────────
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`⚡ CACHE_HIT [journey] PNR: ${pnr}`);
        const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        parsed.source = 'cache';
        return parsed;
      }
    } catch (err) {
      logger.error('Redis read error in JourneyService:', err);
    }

    // ── 2. Fetch from Provider ────────────────────────────
    logger.info(`🐢 CACHE_MISS [journey] PNR: ${pnr}`);
    let journeyData;

    try {
      journeyData = await journeyProvider.fetchJourneyData(pnr);
    } catch (apiError) {
      // ── 3. Fallback: return stale cache ─────────────────
      logger.warn(`API Error for journey PNR: ${pnr}, 🔁 FALLBACK_TRIGGERED`);
      try {
        const staleData = await redisClient.get(cacheKey);
        if (staleData) {
          const parsed = typeof staleData === 'string' ? JSON.parse(staleData) : staleData;
          parsed.source = 'fallback';
          logger.info(`♻️ FALLBACK_HIT [journey] PNR: ${pnr}`);
          return parsed;
        }
      } catch (redisErr) {
        logger.error('Redis fallback read error:', redisErr);
      }

      // No cache at all — return graceful empty
      return {
        pnr,
        trainNumber: null,
        trainName: null,
        status: 'UNAVAILABLE',
        source: 'fallback',
        fallback: true,
        message: 'Journey data temporarily unavailable. Please try again shortly.'
      };
    }

    // ── 4. Store in Redis ─────────────────────────────────
    try {
      await redisClient.set(cacheKey, JSON.stringify(journeyData), { ex: this.CACHE_TTL });
      logger.info(`💾 CACHED [journey] PNR: ${pnr} (TTL: ${this.CACHE_TTL}s)`);
    } catch (err) {
      logger.error('Redis set error in JourneyService:', err);
    }

    // ── 5. Async Supabase Upsert (fire-and-forget) ───────
    if (userId && journeyData.trainNumber) {
      this._persistJourney(userId, journeyData).catch(err => {
        logger.error('Supabase upsert error (non-blocking):', err);
      });
    }

    journeyData.source = 'api';
    return journeyData;
  }

  /**
   * Fire-and-forget: Upsert journey record to Supabase.
   * NOT awaited in the hot path to keep API fast.
   */
  async _persistJourney(userId, data) {
    const journeyRecord = {
      user_id: userId,
      pnr: data.pnr,
      train_number: data.trainNumber,
      from_station: data.currentStation?.code || data.routeStations?.[0]?.code || 'N/A',
      to_station: data.destination?.code || 'N/A',
      journey_date: data.journeyDate || new Date().toISOString().split('T')[0],
      status: this._resolveStatus(data.status),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('journeys')
      .upsert(journeyRecord, {
        onConflict: 'user_id,pnr'
      });

    if (error) {
      logger.error('Supabase journey upsert failed:', error);
    } else {
      logger.info(`📝 PERSISTED [journey] PNR: ${data.pnr}`);
    }
  }

  _resolveStatus(apiStatus) {
    if (!apiStatus) return 'upcoming';
    const s = apiStatus.toUpperCase();
    if (s === 'RUNNING' || s === 'ACTIVE' || s === 'BOARDED') return 'active';
    if (s === 'COMPLETED' || s === 'ARRIVED') return 'completed';
    return 'upcoming';
  }
}

module.exports = new JourneyService();
