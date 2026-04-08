const axios = require('axios');
const logger = require('../utils/logger');

class LiveTrainProvider {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = 'https://indian-railway-irctc.p.rapidapi.com/api/trains/v1/train/status';
  }

  async fetchLiveStatus(trainNumber, departureDate) {
    logger.info(`Fetching live train status for ${trainNumber} on ${departureDate} from external API`);
    
    // Fallback to mock if API key isn't provided
    if (!this.apiKey || this.apiKey === 'YOUR_RAPIDAPI_KEY') {
      logger.warn('No valid RAPIDAPI_KEY found, returning MOCK data for provider level.');
      return this._getMockResponse(trainNumber);
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
