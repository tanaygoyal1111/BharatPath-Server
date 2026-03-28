const pnrService = require('../services/PNRService');
const logger = require('../utils/logger');

class PNRController {
  async getStatus(req, res) {
    const { pnr } = req.params;
    
    try {
      logger.info(`Received PNR status request for: ${pnr}`);
      
      const pnrData = await pnrService.getPNRStatus(pnr);
      
      return res.status(200).json({
        success: true,
        data: pnrData,
        error: null
      });
    } catch (error) {
      logger.error(`Error in PNRController.getStatus for PNR ${pnr}:`, error);
      
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message || 'Internal Server Error'
      });
    }
  }
}

module.exports = new PNRController();
