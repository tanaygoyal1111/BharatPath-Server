const amenitiesService = require('../services/amenitiesService');
const logger = require('../utils/logger');

class AmenitiesController {
  async getAmenities(req, res) {
    const { lat, lng } = req.query;

    logger.info(`Processing amenities request — lat: ${lat}, lng: ${lng}`);

    try {
      const result = await amenitiesService.getNearbyAmenities(lat, lng);

      return res.status(200).json({
        success: true,
        data: {
          amenities: result.amenities,
          count: result.amenities.length,
          coordinates: {
            lat: parseFloat(lat),
            lng: parseFloat(lng)
          }
        },
        source: result.source,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Error in AmenitiesController.getAmenities:`, error);

      return res.status(500).json({
        success: false,
        data: null,
        error: error.message || 'Unable to fetch nearby amenities',
        timestamp: Date.now()
      });
    }
  }
}

module.exports = new AmenitiesController();
