const axios = require('axios');
const apiKeyManager = require('./apiKeyManager');
const logger = require('./logger');

const rapidApiClient = axios.create();

// Response Interceptor: The magic happens here
rapidApiClient.interceptors.response.use(
  (response) => response, // If successful, just pass it through
  async (error) => {
    const originalRequest = error.config;
    
    // If we hit a 403 (Quota Exceeded) or 429 (Rate Limit), and we haven't retried yet
    if (error.response && [403, 429].includes(error.response.status) && !originalRequest._retry) {
      originalRequest._retry = true;
      
      logger.warn(`API Limit reached (Status: ${error.response.status}). Intercepting and rotating key...`);
      
      // Rotate the key globally
      const newKey = apiKeyManager.rotateKey();
      
      // Inject the new key into the headers of the failed request.
      // Checking both common casings to ensure we overwrite the old key perfectly.
      if (originalRequest.headers['x-rapidapi-key']) {
        originalRequest.headers['x-rapidapi-key'] = newKey;
      }
      if (originalRequest.headers['X-RapidAPI-Key']) {
        originalRequest.headers['X-RapidAPI-Key'] = newKey;
      }
      
      // Replay the request with the new key!
      return rapidApiClient(originalRequest);
    }
    
    // If it's a different error (like 404), or we already retried, let it fail normally
    return Promise.reject(error);
  }
);

module.exports = rapidApiClient;
