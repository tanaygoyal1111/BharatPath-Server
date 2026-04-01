const axios = require('axios');
const logger = require('../utils/logger');

const OVERPASS_API_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';

class AmenitiesProvider {
  constructor() {
    this.timeout = 5000; // 5 second hard timeout
  }

  /**
   * Fetch nearby amenities from Overpass API (OpenStreetMap).
   * Queries for hospitals, hotels, restaurants, pharmacies, ATMs, police stations
   * within a given radius of the coordinates.
   *
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radiusMeters - Search radius in meters (default: 2000)
   * @returns {Array} Clean amenity objects
   */
  async fetchNearbyAmenities(lat, lng, radiusMeters = 2000) {
    logger.info(`Fetching amenities near (${lat}, ${lng}) radius: ${radiusMeters}m`);

    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
        node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
        node["tourism"="hotel"](around:${radiusMeters},${lat},${lng});
        node["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
        node["amenity"="atm"](around:${radiusMeters},${lat},${lng});
        node["amenity"="bank"](around:${radiusMeters},${lat},${lng});
        node["amenity"="police"](around:${radiusMeters},${lat},${lng});
        node["amenity"="fuel"](around:${radiusMeters},${lat},${lng});
      );
      out body;
    `.trim();

    try {
      const response = await axios.post(
        OVERPASS_API_URL,
        `data=${encodeURIComponent(overpassQuery)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.timeout
        }
      );

      const elements = response.data?.elements || [];
      logger.info(`Overpass returned ${elements.length} amenity nodes`);

      return this._transformElements(elements, lat, lng);
    } catch (error) {
      // Overpass can be slow/unavailable — NEVER throw, return empty
      logger.error('Overpass API error:', error.message);
      return [];
    }
  }

  /**
   * Transform raw Overpass elements into clean amenity objects.
   */
  _transformElements(elements, originLat, originLng) {
    return elements
      .filter(el => el.tags && (el.tags.name || el.tags.amenity || el.tags.tourism))
      .map(el => {
        const type = this._resolveType(el.tags);
        const name = el.tags.name || el.tags['name:en'] || this._fallbackName(type);
        const distance = this._haversineDistance(originLat, originLng, el.lat, el.lon);

        return {
          id: String(el.id),
          type,
          name,
          lat: el.lat,
          lng: el.lon,
          distance: Math.round(distance), // meters
          address: el.tags['addr:street'] || el.tags['addr:full'] || null,
          phone: el.tags.phone || el.tags['contact:phone'] || null
        };
      })
      .sort((a, b) => a.distance - b.distance); // Closest first
  }

  _resolveType(tags) {
    if (tags.amenity === 'hospital') return 'hospital';
    if (tags.amenity === 'pharmacy') return 'pharmacy';
    if (tags.amenity === 'restaurant') return 'restaurant';
    if (tags.amenity === 'atm' || tags.amenity === 'bank') return 'atm';
    if (tags.amenity === 'police') return 'police';
    if (tags.amenity === 'fuel') return 'fuel';
    if (tags.tourism === 'hotel') return 'hotel';
    return 'other';
  }

  _fallbackName(type) {
    const names = {
      hospital: 'Hospital',
      pharmacy: 'Pharmacy',
      hotel: 'Hotel',
      restaurant: 'Restaurant',
      atm: 'ATM/Bank',
      police: 'Police Station',
      fuel: 'Fuel Station'
    };
    return names[type] || 'Amenity';
  }

  /**
   * Haversine formula: distance between two lat/lng points in meters.
   */
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

module.exports = new AmenitiesProvider();
