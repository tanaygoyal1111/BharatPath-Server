const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const amenitiesController = require('../controllers/amenitiesController');
const validate = require('../middleware/validate');
const { amenitiesBodySchema } = require('../validators/amenitiesValidator');

// Aggressive rate limit: 30 requests per minute per IP
// Protects Overpass API from abuse
const amenitiesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many amenity requests. Please try again after a minute.',
    timestamp: Date.now()
  }
});

// POST /api/v1/amenities — Public (no auth required)
router.post(
  '/',
  amenitiesLimiter,
  validate(amenitiesBodySchema),
  amenitiesController.getNearbyAmenities
);

module.exports = router;
