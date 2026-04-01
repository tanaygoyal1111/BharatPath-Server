const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const proximityController = require('../controllers/proximityController');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { journeyParamsSchema } = require('../validators/journeyValidator');

// Rate limit: 60 requests per minute per IP
const proximityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Too many proximity requests. Please try again after a minute.',
    timestamp: Date.now()
  }
});

// GET /api/v1/proximity/:pnr — Auth required
router.get(
  '/:pnr',
  proximityLimiter,
  authMiddleware,
  validate(journeyParamsSchema),
  proximityController.getProximity
);

module.exports = router;
