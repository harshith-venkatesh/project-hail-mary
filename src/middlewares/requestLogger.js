const logger = require('../config/logger');

/**
 * HTTP request/response logger middleware.
 * Logs method, path, status, and response time.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
