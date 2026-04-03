const amenitiesService = require('../services/amenitiesService');
const logger = require('../utils/logger');

class AmenitiesController {
  async getNearbyAmenities(req, res) {
    const { lat, lng } = req.body;

    logger.info(`[AmenitiesController] POST /amenities — lat: ${lat}, lng: ${lng}`);

    try {
      const result = await amenitiesService.getNearbyAmenities(lat, lng);

      return res.status(200).json({
        success: true,
        data: {
          hospitals: result.hospitals,
          hotels: result.hotels
        }
      });
    } catch (error) {
      logger.error('[AmenitiesController] Unhandled error:', error);

      // NEVER crash — return empty arrays on failure
      return res.status(200).json({
        success: true,
        data: {
          hospitals: [],
          hotels: []
        }
      });
    }
  }
}

module.exports = new AmenitiesController();
