const createError = require('http-errors');

/**
 * Catch-all for unmatched routes. Must sit between route definitions and errorHandler.
 */
function notFound(req, _res, next) {
  next(createError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFound;
