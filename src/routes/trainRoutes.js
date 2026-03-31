const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const trainController = require('../controllers/trainController');
const validate = require('../middleware/validate');
const { trainSearchSchema, liveTrainSchema } = require('../validators/trainValidator');

const liveTrainLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again after a minute' }
});

router.get('/search', validate(trainSearchSchema), trainController.search);
router.get('/live/:trainNumber', liveTrainLimiter, validate(liveTrainSchema), trainController.getLiveStatus);

module.exports = router;
