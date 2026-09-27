/**
 * errorHandler.js
 * ---------------
 * Centralized error-handling middleware. Ensures we never leak stack
 * traces or internal details to clients, while still logging full detail
 * server-side for debugging.
 */

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} was not found.`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.stack || err.message || err);

  // express.json() throws a SyntaxError for malformed JSON bodies.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Malformed JSON in request body.',
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'PayloadTooLarge',
      message: 'Request body is too large.',
    });
  }

  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  res.status(statusCode).json({
    error: 'InternalServerError',
    message: statusCode === 500 ? 'Something went wrong. Please try again later.' : err.message,
  });
}

module.exports = { notFoundHandler, errorHandler };
