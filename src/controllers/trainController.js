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
}

module.exports = new TrainController();
