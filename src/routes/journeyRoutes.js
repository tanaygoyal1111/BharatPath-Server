const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const journeyController = require('../controllers/journeyController');
const validate = require('../middleware/validate');
const { journeyParamsSchema } = require('../validators/journeyValidator');

// Rate limit: 60 requests per minute per IP
const journeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Too many journey requests. Please try again after a minute.',
    timestamp: Date.now()
  }
});

// GET /api/v1/journey/:pnr — Auth optional (graceful degradation)
router.get(
  '/:pnr',
  journeyLimiter,
  validate(journeyParamsSchema),
  journeyController.getJourney
);

module.exports = router;

