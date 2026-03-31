const trainService = require('../services/trainService');
const logger = require('../utils/logger');

class TrainController {
  async search(req, res) {
    const { from, to, date } = req.query;

    logger.info(`Processing train search: ${from} -> ${to} on ${date}`);

    const trains = await trainService.searchTrains(from, to, date);

    res.status(200).json({
      success: true,
      count: trains.length,
      data: trains,
      error: null
    });
  }

  async getLiveStatus(req, res) {
    const { trainNumber } = req.params;
    logger.info(`Processing live status request for train: ${trainNumber}`);

    try {
      const liveData = await trainService.getLiveTrainStatus(trainNumber);

      res.status(200).json({
        success: true,
        data: liveData,
        error: null
      });
    } catch (error) {
      // 500 when API and fallback both fail
      res.status(500).json({
        success: false,
        error: error.message || "Unable to fetch live train status"
      });
    }
  }
}

module.exports = new TrainController();
