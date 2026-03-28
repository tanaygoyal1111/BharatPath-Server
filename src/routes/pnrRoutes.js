const express = require('express');
const router = express.Router();
const pnrController = require('../controllers/PNRController');
const validate = require('../middleware/validate');
const { pnrSchema } = require('../validators/pnrValidator');

router.get('/:pnr', validate(pnrSchema), pnrController.getStatus);

module.exports = router;
