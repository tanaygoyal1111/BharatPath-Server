const axios = require('axios');
const logger = require('../utils/logger');

class RailwayProvider {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = 'irctc-indian-railway-pnr-status.p.rapidapi.com';
    this.baseUrl = 'https://irctc-indian-railway-pnr-status.p.rapidapi.com/getPNRStatus';
  }

  async getPNRStatus(pnr) {
    // ── Dev Sandbox ──────────────────────────────────────────────────
    // Return a pre-normalized mock object for frontend UI testing
    // without consuming a real API call.
    if (pnr === '9999999999') {
      logger.info('🧪 DEV SANDBOX: Returning mock PNR for 9999999999');
      return {
        pnr: '9999999999',
        trainNo: '11061',
        trainName: 'LTT JAYNAGAR EXP',
        sourceCode: 'LTT',
        sourceCity: 'MUMBAI LTT',
        destCode: 'BSB',
        destCity: 'VARANASI JN',
        departs: new Date('Feb 9, 2025 11:30:05 AM').toISOString(),
        arrival: new Date('Nov 30, 2024 12:25:05 PM').toISOString(),
        platform: 'TBA',
        coach: 'WL',
        seat: '35',
        statusTag: 'PQWL',
        subText: 'Chart Not Prepared',
        currentLocation: null,
        eta: null,
        progressPct: 0,
        __sandbox: true, // Flag so the service layer skips normalization
      };
    }

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
