const axios = require('../utils/rapidApiClient');
const logger = require('../utils/logger');

class LiveTrainProvider {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = 'https://indian-railway-irctc.p.rapidapi.com/api/trains/v1/train/status';
  }

  async fetchLiveStatus(trainNumber, departureDate) {
    logger.info(`Fetching live train status for ${trainNumber} on ${departureDate} from external API`);
    
    if (!this.apiKey || this.apiKey === 'YOUR_RAPIDAPI_KEY') {
      throw new Error('CRITICAL: RAPIDAPI_KEY is missing from environment variables.');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: { 
          train_number: trainNumber,
          departure_date: departureDate,
          isH5: 'true',
          client: 'web',
          deviceIdentifier: 'web-client'
        },
        headers: {
          'x-rapid-api': 'rapid-api-database',
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'indian-railway-irctc.p.rapidapi.com'
        },
        timeout: 5000 // 5 seconds timeout constraint as per requirements
      });

      return response.data;
    } catch (error) {
      logger.error('API Error in LiveTrainProvider.fetchLiveStatus', error.message);
      throw error; 
    }
  }

}

module.exports = new LiveTrainProvider();
