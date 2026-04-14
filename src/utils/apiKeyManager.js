const logger = require('./logger');

class ApiKeyManager {
  constructor() {
    const keysString = process.env.RAPIDAPI_KEYS || '';
    // Split by comma, trim spaces, and remove empties
    this.keys = keysString.split(',').map(k => k.trim()).filter(k => k);
    this.currentIndex = 0;

    if (this.keys.length === 0) {
      logger.warn('⚠️ No RAPIDAPI_KEYS found in environment variables.');
    } else {
      logger.info(`🔑 ApiKeyManager initialized with ${this.keys.length} keys.`);
    }
  }

  getCurrentKey() {
    if (this.keys.length === 0) return 'MISSING_KEY';
    return this.keys[this.currentIndex];
  }

  rotateKey() {
    if (this.keys.length <= 1) {
      logger.warn('⚠️ Cannot rotate key: Only one key in pool.');
      return this.getCurrentKey();
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    logger.info(`🔄 API Key rotated! Now using key index: ${this.currentIndex}`);
    return this.getCurrentKey();
  }
}

module.exports = new ApiKeyManager();
