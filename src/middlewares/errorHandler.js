const logger = require('../config/logger');
const { nodeEnv } = require('../config/env');

/**
 * Central error-handling middleware.
 * Must be registered last in the Express middleware chain.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    logger.error(err);
  }

  const body = { error: { status, message } };

  if (err.details) {
    body.error.details = err.details;
  }

  if (nodeEnv !== 'production' && status >= 500) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
