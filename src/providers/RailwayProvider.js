const axios = require('../utils/rapidApiClient');
const logger = require('../utils/logger');

class RailwayProvider {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = 'irctc-indian-railway-pnr-status.p.rapidapi.com';
    this.baseUrl = 'https://irctc-indian-railway-pnr-status.p.rapidapi.com/getPNRStatus';
  }

  async getPNRStatus(pnr) {
    // ── Live API Call ────────────────────────────────────────────────
    try {
      logger.info(`Fetching PNR status for ${pnr} from IRCTC RapidAPI`);

      const response = await axios.get(`${this.baseUrl}/${pnr}`, {
        headers: {
          'x-rapidapi-host': this.apiHost,
          'x-rapidapi-key': this.apiKey,
        },
        timeout: parseInt(process.env.API_TIMEOUT, 10) || 8000,
      });

      const raw = response.data?.data;

      if (!raw) {
        logger.warn('IRCTC PNR API returned empty data payload', {
          pnr,
          responseShape: typeof response.data,
        });
        throw new Error(`No PNR data returned for ${pnr}`);
      }

      logger.info(`IRCTC PNR API success for ${pnr}`);
      return raw;
    } catch (error) {
      if (error.response) {
        logger.error(`IRCTC PNR API error: ${error.response.status}`, {
          pnr,
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        logger.error('IRCTC PNR API network/timeout error', {
          pnr,
          message: error.message,
        });
      }
      throw error;
    }
  }
}

module.exports = new RailwayProvider();
