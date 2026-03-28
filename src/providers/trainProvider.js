const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class TrainProvider {
  constructor() {
    this.mockDataPath = path.join(__dirname, 'mockTrains.json');
  }

  async fetchTrainsBetweenStations(from, to, date) {
    try {
      logger.info(`Fetching trains from ${from} to ${to} for date ${date}`);
      
      // Artificial delay as per requirement
      await new Promise(res => setTimeout(res, 1500));

      const rawData = await fs.readFile(this.mockDataPath, 'utf8');
      const trains = JSON.parse(rawData);

      // Derive day of week from date
      const dayOfWeek = this._getDayOfWeek(date);
      logger.debug(`Derived day of week: ${dayOfWeek}`);

      // Filter by station codes and running days
      const filteredTrains = trains.filter(train => {
        const isCorrectRoute = train.departure.station === from && train.arrival.station === to;
        const runsOnDay = train.runningDays[dayOfWeek] === true;
        return isCorrectRoute && runsOnDay;
      });

      return filteredTrains;
    } catch (error) {
      logger.error('Error in TrainProvider.fetchTrainsBetweenStations', error);
      throw error;
    }
  }

  _getDayOfWeek(dateString) {
    const days = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
    // Use split and Date.UTC to ensure timezone independence
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Since we created it in UTC, we must use getUTCDay
    return days[date.getUTCDay()];
  }
}

module.exports = new TrainProvider();
