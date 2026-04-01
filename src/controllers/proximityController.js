const proximityService = require('../services/proximityService');
const logger = require('../utils/logger');

class ProximityController {
  async getProximity(req, res) {
    const { pnr } = req.params;
    const userId = req.user?.id || null;

    logger.info(`Processing proximity request — PNR: ${pnr}, User: ${userId || 'anonymous'}`);

    try {
      const data = await proximityService.getProximityData(pnr, userId);

      return res.status(200).json({
        success: true,
        data,
        source: data.source || 'api',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Error in ProximityController.getProximity for PNR ${pnr}:`, error);

      return res.status(500).json({
        success: false,
        data: null,
        error: error.message || 'Unable to fetch proximity data',
        timestamp: Date.now()
      });
    }
  }
}

module.exports = new ProximityController();
