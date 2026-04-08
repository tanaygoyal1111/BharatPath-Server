const axios = require('axios');
const logger = require('../utils/logger');

class TrainProvider {
  constructor() {
    this.apiHost = 'irctc-api2.p.rapidapi.com';
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = 'https://irctc-api2.p.rapidapi.com/trainAvailability';
  }

  /**
   * Converts YYYY-MM-DD (or ISO string) to DD-MM-YYYY format required by the API.
   */
  _formatDate(dateString) {
    // Handle ISO strings by taking just the date part
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}-${month}-${year}`;
  }

  /**
   * Fetches trains between two stations for a given date from the IRCTC API.
   * Returns data already normalized to match the frontend TypeScript interface.
   */
  async fetchTrainsBetweenStations(from, to, date) {
    const formattedDate = this._formatDate(date);

    logger.info(`Fetching trains from ${from} to ${to} for date ${formattedDate} (original: ${date})`);

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          source: from,
          destination: to,
          date: formattedDate,
        },
        headers: {
          'x-rapidapi-host': this.apiHost,
          'x-rapidapi-key': this.apiKey,
        },
        timeout: parseInt(process.env.API_TIMEOUT, 10) || 8000,
      });

      const apiDataArray = response.data?.data;

      if (!Array.isArray(apiDataArray)) {
        logger.warn('IRCTC API returned non-array data, returning empty list', {
          responseShape: typeof response.data,
        });
        return [];
      }

      logger.info(`IRCTC API returned ${apiDataArray.length} trains`);

      // Normalize to frontend schema
      return apiDataArray.map(raw => ({
        trainNumber: raw.trainNumber,
        trainName: raw.trainName,
        type: 'EXP', // Fallback type
        duration: raw.duration, // Pass as is, e.g., "17h 5m"
        departure: { time: raw.departure, station: raw.from.code },
        arrival: { time: raw.arrival, station: raw.to.code },
        runningDays: {
          M: raw.runningDays.includes('Mon'),
          Tu: raw.runningDays.includes('Tue'),
          W: raw.runningDays.includes('Wed'),
          Th: raw.runningDays.includes('Thu'),
          F: raw.runningDays.includes('Fri'),
          Sa: raw.runningDays.includes('Sat'),
          Su: raw.runningDays.includes('Sun'),
        },
        classes: raw.allClasses,
      }));
    } catch (error) {
      if (error.response) {
        logger.error(`IRCTC API error: ${error.response.status}`, {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        logger.error('IRCTC API network/timeout error', { message: error.message });
      }
      throw error;
    }
  }
}

module.exports = new TrainProvider();
