const axios = require('axios');
const logger = require('../utils/logger');

const OVERPASS_API_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';

class AmenitiesProvider {
  constructor() {
    this.timeout = 8000; // 8s hard timeout — Overpass can be slow
  }

  /**
   * Fetch nearby hospitals & hotels from Overpass API (OpenStreetMap).
   * Returns categorized { hospitals, hotels } arrays.
   *
   * @param {number} lat - Latitude (already rounded)
   * @param {number} lng - Longitude (already rounded)
   * @returns {{ hospitals: Array, hotels: Array }}
   */
  async fetchNearbyAmenities(lat, lng) {
    logger.info(`[AmenitiesProvider] Fetching amenities near (${lat}, ${lng}) radius: 2000m`);

    const query = `
[out:json][timeout:10];
(
  node["amenity"="hospital"](around:2000,${lat},${lng});
  node["tourism"="hotel"](around:2000,${lat},${lng});
);
out;
    `.trim();

    try {
      const response = await axios.post(
        OVERPASS_API_URL,
        `data=${encodeURIComponent(query)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.timeout
        }
      );

      const elements = response.data?.elements || [];
      logger.info(`[AmenitiesProvider] Overpass returned ${elements.length} nodes`);

      return this._categorize(elements, lat, lng);
    } catch (error) {
      // Overpass can be slow/unavailable — NEVER crash, return empty
      logger.error('[AmenitiesProvider] Overpass API error:', error.message);
      return { hospitals: [], hotels: [] };
    }
  }

  /**
   * Categorize raw Overpass elements into { hospitals, hotels }.
   */
  _categorize(elements, originLat, originLng) {
    const hospitals = [];
    const hotels = [];

    for (const el of elements) {
      if (!el.tags) continue;

      const name = el.tags.name || el.tags['name:en'] || null;
      if (!name) continue; // skip unnamed nodes

      const item = {
        name,
        lat: el.lat,
        lng: el.lon
      };

      if (el.tags.amenity === 'hospital') {
        hospitals.push(item);
      } else if (el.tags.tourism === 'hotel') {
        hotels.push(item);
      }
    }

    return { hospitals, hotels };
  }
}

module.exports = new AmenitiesProvider();
