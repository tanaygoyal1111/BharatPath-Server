const axios = require('axios');
const logger = require('../utils/logger');

class LiveTrainProvider {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = process.env.RAPIDAPI_URL || 'https://irctc1.p.rapidapi.com/api/v1/liveTrainStatus';
  }

  async fetchLiveStatus(trainNumber) {
    logger.info(`Fetching live train status for ${trainNumber} from external API`);
    
    // Fallback to mock if API key isn't provided
    if (!this.apiKey || this.apiKey === 'YOUR_RAPIDAPI_KEY') {
      logger.warn('No valid RAPIDAPI_KEY found, returning MOCK data for provider level.');
      return this._getMockResponse(trainNumber);
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: { trainNo: trainNumber },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'irctc1.p.rapidapi.com'
        },
        timeout: 5000 // 5 seconds timeout constraint as per requirements
      });

      return response.data;
    } catch (error) {
      logger.error('API Error in LiveTrainProvider.fetchLiveStatus', error.message);
      throw error; 
    }
  }

  _getMockResponse(trainNumber) {
    // Return structured mock response loosely resembling what the real API might return
    return {
      success: true,
      data: {
        trainNo: trainNumber,
        trainName: "RAJdhani Express",
        status: "RUNNING",
        delayInMinutes: 15,
        platform: "3",
        dateOfJourney: new Date().toISOString().split('T')[0],
        currentStation: {
          stationName: "NEW DELHI",
          stationCode: "NDLS"
        },
        nextStation: {
          stationName: "KANPUR CENTRAL",
          stationCode: "CNB",
          distance: 440,
          eta: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
        }
      }
    };
  }
}

module.exports = new LiveTrainProvider();
