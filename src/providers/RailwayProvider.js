const axios = require('axios');
const logger = require('../utils/logger');

class RailwayProvider {
  constructor() {
    this.apiKey = process.env.RAILWAY_API_KEY;
    this.baseUrl = process.env.RAILWAY_API_BASE_URL || 'https://api.railwayapi.com/v2/pnr-status';
  }

  async getPNRStatus(pnr) {
    try {
      logger.info(`Fetching PNR status for ${pnr} from external API`);
      
      // In a real scenario, we would call the actual API:
      // const response = await axios.get(`${this.baseUrl}/pnr/${pnr}/apikey/${this.apiKey}/`);
      // return response.data;

      // For demonstration/mock purposes strictly following the user's request for a provider layer:
      return this._getMockResponse(pnr);
    } catch (error) {
      logger.error('Error in RailwayProvider.getPNRStatus', error);
      throw error;
    }
  }

  _getMockResponse(pnr) {
    // Mocking an external API response format (often messy)
    return {
      response_code: 200,
      debit: 3,
      pnr: pnr,
      position: "Confirmed",
      train: {
        name: "SEALDAH DURONTO",
        number: "12259"
      },
      board_station: {
        name: "NEW DELHI",
        code: "NDLS"
      },
      reservation_upto: {
        name: "SEALDAH",
        code: "SDAH"
      },
      journey_class: {
        code: "3A",
        name: "THIRD AC"
      },
      passengers: [
        {
          no: 1,
          booking_status: "CNF/B4/22",
          current_status: "CNF"
        }
      ],
      from_station: {
        name: "NEW DELHI",
        code: "NDLS"
      },
      to_station: {
        name: "SEALDAH",
        code: "SDAH"
      },
      doj: "01-04-2026",
      total_passengers: 1,
      chart_prepared: true
    };
  }
}

module.exports = new RailwayProvider();
