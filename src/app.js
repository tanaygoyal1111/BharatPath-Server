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

// Routes
app.use('/api/pnr', require('./routes/pnrRoutes'));
app.use('/api/trains', require('./routes/trainRoutes'));

// Error handling
app.use(errorHandler);

module.exports = app;
