const { redisClient } = require('../config/redis');
const railwayProvider = require('../providers/RailwayProvider');
const logger = require('../utils/logger');

class PNRService {
  constructor() {
    this.CACHE_TTL = 15 * 60; // 15 minutes in seconds
  }

  async getPNRStatus(pnr) {
    const cacheKey = `pnr:${pnr}`;
    let cachedData = null;

    // 1. Try to get from Cache
    try {
      const data = await redisClient.get(cacheKey);
      if (data) {
        cachedData = typeof data === 'string' ? JSON.parse(data) : data;
        logger.info(`Cache HIT for PNR: ${pnr}`);
      }
    } catch (err) {
      logger.error(`Redis get error for PNR ${pnr}:`, err);
    }

    // 2. Fetch from Provider
    try {
      if (!cachedData) {
        logger.info(`Cache MISS for PNR: ${pnr}`);
      }
      
      const pnrData = await railwayProvider.getPNRStatus(pnr);
      
      // Store in Redis (Background)
      redisClient.set(cacheKey, JSON.stringify(pnrData), { ex: this.CACHE_TTL })
        .catch(err => logger.error(`Redis set error for PNR ${pnr}:`, err));

      return this.transformPNR(pnrData);
    } catch (err) {
      // 3. Fallback to Cache on API Failure
      if (cachedData) {
        logger.warn(`API failure for PNR: ${pnr}, falling back to cached data`);
        return this.transformPNR(cachedData);
      }
      
      logger.error(`API failure for PNR: ${pnr} and no cached data available`);
      throw err;
    }
  }

  transformPNR(rawData) {
    if (!rawData) return null;

    // Parse Date of Journey (DD-MM-YYYY)
    // Example: "27-03-2026"
    const [day, month, year] = rawData.doj.split('-').map(Number);
    
    // Standardize times (Assuming 18:15 departure and 06:45 arrival as per requirement example)
    // In a real API, these would come from the response.
    const departureDate = new Date(year, month - 1, day, 18, 15, 0);
    const arrivalDate = new Date(departureDate);
    // Arrival is usually next day or late night for long journeys
    arrivalDate.setHours(arrivalDate.getHours() + 12, 30); 

    const now = new Date();
    let journeyStatus = 'UPCOMING';
    if (now > arrivalDate) {
      journeyStatus = 'COMPLETED';
    } else if (now >= departureDate) {
      journeyStatus = 'ACTIVE';
    }

    // Parse coach and seat from booking_status (e.g., "CNF/B4/22")
    const mainPassenger = rawData.passengers && rawData.passengers[0];
    let coach = 'N/A';
    let seat = 'N/A';
    
    if (mainPassenger && mainPassenger.booking_status) {
      const parts = mainPassenger.booking_status.split('/');
      // Expected format: STATUS/COACH/SEAT
      if (parts.length >= 3) {
        coach = parts[1];
        seat = parts[2];
      }
    }

    return {
      pnr: rawData.pnr,
      trainNumber: rawData.train.number,
      trainName: rawData.train.name,
      from: {
        code: rawData.from_station.code,
        name: this._capitalize(rawData.from_station.name)
      },
      to: {
        code: rawData.to_station.code,
        name: this._capitalize(rawData.to_station.name)
      },
      departureTime: departureDate.toISOString(),
      arrivalTime: arrivalDate.toISOString(),
      platform: "PF 12", // Mocked as it's not in the provider
      coach: coach,
      seat: seat,
      status: (rawData.position || (mainPassenger ? mainPassenger.current_status : 'UNKNOWN')).toUpperCase(),
      journeyStatus: journeyStatus
    };
  }

  _capitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}

module.exports = new PNRService();
