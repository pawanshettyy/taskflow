/**
 * server.js
 * ---------
 * Application entry point. Sets up Express with security middleware,
 * mounts the API routes, and serves the static frontend from /public.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const chatRoutes = require('./src/routes/chatRoutes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security & core middleware --------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-session-id'],
    exposedHeaders: ['x-session-id'],
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Limit body size to protect against oversized-payload abuse.
app.use(express.json({ limit: '10kb' }));

// Rate limiting to protect the API from abuse/brute force.
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many requests. Please try again later.' },
});
app.use('/api', apiLimiter);

// --- Static frontend --------------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

// --- API routes --------------------------------------------------------------

app.use('/api', chatRoutes);

// --- Error handling ----------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// Only start listening if this file is run directly (not when required by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NLP Chatbot server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
