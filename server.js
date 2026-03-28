const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5001;
const { connectRedis } = require('./src/config/redis');

const startServer = async () => {
  await connectRedis();
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
};

startServer();

