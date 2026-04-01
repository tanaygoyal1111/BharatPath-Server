const journeyService = require('../services/journeyService');
const logger = require('../utils/logger');

class JourneyController {
  async getJourney(req, res) {
    const { pnr } = req.params;
    const userId = req.user?.id || null;

    logger.info(`Processing journey request — PNR: ${pnr}, User: ${userId || 'anonymous'}`);

    try {
      const data = await journeyService.getJourneyData(pnr, userId);

      return res.status(200).json({
        success: true,
        data,
        source: data.source || 'api',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Error in JourneyController.getJourney for PNR ${pnr}:`, error);

      return res.status(500).json({
        success: false,
        data: null,
        error: error.message || 'Unable to fetch journey data',
        timestamp: Date.now()
      });
    }
  }
}

module.exports = new JourneyController();
