const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Validates Supabase JWT from Authorization header.
 * Attaches req.user = { id, email } on success.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      timestamp: Date.now()
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token not provided',
      timestamp: Date.now()
    });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn(`Auth failed: ${error?.message || 'No user returned'}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: Date.now()
      });
    }

    // Attach user to request for downstream handlers
    req.user = {
      id: user.id,
      email: user.email
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
      timestamp: Date.now()
    });
  }
};

module.exports = authMiddleware;
