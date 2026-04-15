require('dotenv').config();
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 🩺 Health Check Route for Render / Cron-job.org
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BharatPath Backend is Awake and Routing!',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/v1/pnr', require('./routes/pnrRoutes'));
app.use('/api/v1/trains', require('./routes/trainRoutes'));
app.use('/api/v1/journey', require('./routes/journeyRoutes'));
app.use('/api/v1/proximity', require('./routes/proximityRoutes'));
app.use('/api/v1/amenities', require('./routes/amenitiesRoutes'));

// Error handling
app.use(errorHandler);

module.exports = app;
