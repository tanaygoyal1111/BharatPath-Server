const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const amenitiesController = require('../controllers/amenitiesController');
const validate = require('../middleware/validate');
const { amenitiesQuerySchema } = require('../validators/amenitiesValidator');

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

// GET /api/v1/amenities?lat=...&lng=...  — Public (no auth)
router.get(
  '/',
  amenitiesLimiter,
  validate(amenitiesQuerySchema),
  amenitiesController.getAmenities
);

module.exports = router;
