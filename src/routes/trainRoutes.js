const express = require('express');
const router = express.Router();
const trainController = require('../controllers/trainController');
const validate = require('../middleware/validate');
const { trainSearchSchema } = require('../validators/trainValidator');

router.get('/search', validate(trainSearchSchema), trainController.search);

module.exports = router;
