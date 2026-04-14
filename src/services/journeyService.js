const { redisClient } = require('../config/redis');
const pnrService = require('./PNRService');
const liveTrainProvider = require('../providers/liveTrainProvider');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const stationCoords = require('../data/coord.json');

class JourneyService {
  constructor() {
    this.CACHE_TTL = 60; // 60 seconds — live data
    this.CACHE_PREFIX = 'journey:v1';
  }

  _enrichWithGPS(body) {
    if (!body || !Array.isArray(body.stations)) return [];
    
    return body.stations.map(station => {
      // Map exact API keys from the live JSON response
      const code = station.stationCode || station.code;
      const coords = stationCoords[code];
      
      const schArr = station.arrivalTime || station.schArrival || null;
      const actArr = station.actual_arrival_time || station.actArrival || null;

      return {
        code: code,
        name: station.stationName || station.name || code,
        schArrival: schArr,
        actArrival: actArr,
        // Single 'time' string the frontend relies on for timeline fallbacks
        time: actArr || schArr || '--:--',
        // API returns 'expected_platform' as an integer
        platform: station.expected_platform ? String(station.expected_platform) : (station.platform || null),
        // API returns 'distance' as a string (e.g. "167")
        distance: parseInt(station.distance || 0, 10),
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null
      };
    });
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
    
    let pnrData;
    let liveData;

    try {
      // Step A: Fetch PNR structure
      pnrData = await pnrService.getPNRStatus(pnr);
      
      const trainNumber = pnrData.trainNo;
      
      // Step B: Format the departureDate into YYYYMMDD
      // Note: PNR API returns `departs` as an ISO String, e.g. '2023-10-15T00:00:00.000Z'
      const formattedDate = pnrData.departs.split('T')[0].replace(/-/g, '');

      // Step C: Fetch Live Status
      liveData = await liveTrainProvider.fetchLiveStatus(trainNumber, formattedDate);
      
    } catch (apiError) {
      // Step D (Fallback): Defensively return PNR data if live fetch fails
      logger.warn(`API Error for journey PNR: ${pnr}, 🔁 FALLBACK_TRIGGERED`, apiError.message);
      
      if (!pnrData) {
        // If we don't even have PNR data (e.g. invalid PNR), try to return stale cache
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

        return {
          pnr,
          trainNumber: null,
          trainName: null,
          status: 'UNAVAILABLE',
          source: 'fallback',
          fallback: true,
          liveStatusAvailable: false,
          statusMessage: 'Journey data temporarily unavailable. Please try again shortly.'
        };
      }

      // Return basic PNR response if live fail but PNR is fine
      const fallbackStartMs = new Date(pnrData.departs).getTime();
      return {
        pnr: pnrData.pnr,
        trainNumber: pnrData.trainNo,
        trainName: pnrData.trainName,
        // ADDED FOR FRONTEND ENGINE:
        startTime: fallbackStartMs,
        endTime: new Date(pnrData.arrival).getTime() || (fallbackStartMs + 86400000),
        isCancelled: false,
        liveStatusAvailable: false,
        currentStationCode: null,
        statusMessage: 'Live status currently unavailable.',
        stations: [
          {
            code: pnrData.sourceCode,
            name: pnrData.sourceCity,
            platform: pnrData.platform,
            seat: pnrData.seat,
            schArrival: pnrData.departs
          },
          {
            code: pnrData.destCode,
            name: pnrData.destCity,
            schArrival: pnrData.arrival
          }
        ]
      };
    }

    // Step D (Hydration)
    let body = liveData; 
    if (liveData && liveData.body) {
      body = liveData.body;
    }

    // Clean the HTML tags out of "Train has crossed <b>Sahatwar</b> at 01:09"
    const message = body.train_status_message || '';
    const cleanMessage = message.replace(/<[^>]*>?/igm, '');
    const isCancelled = body.terminated === true || cleanMessage.toLowerCase().includes('cancel');
    const enrichedStations = this._enrichWithGPS(body);

    // Convert PNR ISO dates to Epoch MS for the frontend state engine
    const startTimeMs = new Date(pnrData.departs).getTime();
    const endTimeMs = new Date(pnrData.arrival).getTime() || (startTimeMs + 86400000);
    
    // Extract current_station (returns "BUI")
    const currStationCode = typeof body.current_station === 'object' 
      ? body.current_station?.station_code 
      : body.current_station;

    const journeyData = {
      pnr: pnrData.pnr,
      trainNumber: pnrData.trainNo,
      trainName: pnrData.trainName,
      // FRONTEND ENGINE REQUIREMENTS:
      startTime: startTimeMs,
      endTime: endTimeMs,
      isCancelled: isCancelled,
      liveStatusAvailable: true,
      currentStationCode: currStationCode || null,
      statusMessage: cleanMessage,
      stations: enrichedStations
    };

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
      from_station: data.currentStationCode || data.stations?.[0]?.code || 'N/A',
      to_station: data.stations?.[data.stations.length - 1]?.code || 'N/A',
      journey_date: new Date().toISOString().split('T')[0],
      status: this._resolveStatus(data.isCancelled ? 'CANCELLED' : 'RUNNING'),
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
    if (s === 'CANCELLED') return 'cancelled';
    return 'upcoming';
  }
}

module.exports = new JourneyService();
