const { ZodError } = require('zod');
const logger = require('../utils/logger');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof ZodError || error.name === 'ZodError') {
      const issues = error.issues || error.errors || [];
      console.error(`[Validate Middleware] Validation failed for ${req.method} ${req.originalUrl}`, JSON.stringify(issues, null, 2));
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: issues.map(e => ({ path: e.path, message: e.message }))
        }
      });
    }
    
    logger.error('Non-Zod error in validate middleware', error);
    next(error);
  }
};

module.exports = validate;
