const { redisClient } = require('../config/redis');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const masterMap = require('../data/master_map.json');

// Standard distance checkpoints for proximity alerts (in km)
const DISTANCE_CHECKPOINTS = [
  { distanceKm: 100, label: '100 km to destination', priority: 'low' },
  { distanceKm: 50,  label: '50 km to destination', priority: 'medium' },
  { distanceKm: 20,  label: '20 km — prepare for arrival', priority: 'high' },
  { distanceKm: 10,  label: 'Approaching destination', priority: 'high' },
  { distanceKm: 5,   label: '5 km — gather your belongings', priority: 'critical' },
  { distanceKm: 2,   label: 'Prepare to alight', priority: 'critical' }
];

class ProximityService {
  constructor() {
    this.CACHE_TTL = 300; // 5 minutes
    this.CACHE_PREFIX = 'proximity:v1';
  }

  /**
   * Get proximity data for a PNR.
   * Returns destination coordinates, upcoming stations, and distance checkpoints.
   *
   * Cache-Aside Pattern with 5-minute TTL.
   */
  async getProximityData(pnr, userId) {
    const cacheKey = `${this.CACHE_PREFIX}:${pnr}`;

    // ── 1. Check Redis Cache ──────────────────────────────
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`⚡ CACHE_HIT [proximity] PNR: ${pnr}`);
        const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        parsed.source = 'cache';
        return parsed;
      }
    } catch (err) {
      logger.error('Redis read error in ProximityService:', err);
    }

    // ── 2. Build Proximity Payload ────────────────────────
    logger.info(`🐢 CACHE_MISS [proximity] PNR: ${pnr}`);

    let proximityData;

    try {
      proximityData = await this._buildProximityPayload(pnr, userId);
    } catch (err) {
      logger.error('Proximity build error:', err);

      // Fallback: try stale cache
      try {
        const staleData = await redisClient.get(cacheKey);
        if (staleData) {
          const parsed = typeof staleData === 'string' ? JSON.parse(staleData) : staleData;
          parsed.source = 'fallback';
          return parsed;
        }
      } catch (redisErr) {
        logger.error('Redis fallback read error in ProximityService:', redisErr);
      }

      // No data at all
      return {
        pnr,
        destination: null,
        upcomingStations: [],
        checkpoints: DISTANCE_CHECKPOINTS,
        source: 'fallback',
        fallback: true,
        message: 'Proximity data temporarily unavailable'
      };
    }

    // ── 3. Store in Redis ─────────────────────────────────
    try {
      await redisClient.set(cacheKey, JSON.stringify(proximityData), { ex: this.CACHE_TTL });
      logger.info(`💾 CACHED [proximity] PNR: ${pnr} (TTL: ${this.CACHE_TTL}s)`);
    } catch (err) {
      logger.error('Redis set error in ProximityService:', err);
    }

    proximityData.source = 'api';
    return proximityData;
  }

  /**
   * Build the proximity payload by resolving station data.
   * Tries Supabase first for the journey record, then falls back to mock route.
   */
  async _buildProximityPayload(pnr, userId) {
    let fromStation = null;
    let toStation = null;

    // Try Supabase for journey record
    if (userId) {
      try {
        const { data: journey, error } = await supabase
          .from('journeys')
          .select('from_station, to_station')
          .eq('pnr', pnr)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && journey) {
          fromStation = journey.from_station;
          toStation = journey.to_station;
          logger.info(`Proximity: resolved from Supabase — ${fromStation} → ${toStation}`);
        }
      } catch (err) {
        logger.warn('Supabase query failed for proximity, using defaults');
      }
    }

    // Fallback: use default NDLS → SDAH route (matches mock data)
    if (!toStation) {
      fromStation = 'NDLS';
      toStation = 'SDAH';
    }

    // Resolve destination coordinates
    const destInfo = masterMap[toStation] || {};
    const destination = {
      code: toStation,
      name: destInfo.name || toStation,
      lat: destInfo.lat || null,
      lng: destInfo.lng || null
    };

    // Build upcoming major stations along route
    const upcomingStations = this._resolveUpcomingStations(fromStation, toStation);

    return {
      pnr,
      destination,
      upcomingStations,
      checkpoints: DISTANCE_CHECKPOINTS,
      totalStationsRemaining: upcomingStations.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Resolve upcoming stations between from and to.
   * Uses known routes from master_map data.
   */
  _resolveUpcomingStations(from, to) {
    // Known route: NDLS → SDAH (the Duronto route from frontend)
    const knownRoutes = {
      'NDLS:SDAH': ['NDLS', 'ALJ', 'TDL', 'CNB', 'PRYJ', 'DDU', 'PNBE', 'KIUL', 'JHAJ', 'ASN', 'SDAH'],
      'NDLS:BSB': ['NDLS', 'ALJ', 'TDL', 'CNB', 'PRYJ', 'BSB'],
      'NDLS:HWH': ['NDLS', 'CNB', 'PRYJ', 'DDU', 'PNBE', 'ASN', 'HWH']
    };

    const routeKey = `${from}:${to}`;
    const route = knownRoutes[routeKey];

    if (!route) {
      // If route not known, return destination only
      const destInfo = masterMap[to] || {};
      return [{
        code: to,
        name: destInfo.name || to,
        lat: destInfo.lat || null,
        lng: destInfo.lng || null
      }];
    }

    // Return stations from current position onward (skip passed stations)
    // For now, assume midway through the journey (index 3 = CNB)
    const currentIndex = 3;
    return route.slice(currentIndex + 1).map(code => {
      const stationInfo = masterMap[code] || {};
      return {
        code,
        name: stationInfo.name || code,
        lat: stationInfo.lat || null,
        lng: stationInfo.lng || null
      };
    });
  }
}

module.exports = new ProximityService();
