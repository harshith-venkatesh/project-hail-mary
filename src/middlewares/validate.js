const { validationResult } = require('express-validator');
const createError = require('http-errors');

/**
 * Runs after express-validator chains.
 * Collects all validation errors and returns a 422 with structured details.
 */
function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
    return next(createError(422, 'Validation failed', { details }));
  }
  next();
}

module.exports = validate;
