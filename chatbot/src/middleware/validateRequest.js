/**
 * validateRequest.js
 * ------------------
 * Input validation & basic sanitization middleware for the /api/chat
 * endpoint. Keeping this separate from the controller means the
 * controller can assume `req.body.message` is always a safe,
 * reasonably-sized, non-empty string by the time it runs.
 */

const { MAX_MESSAGE_LENGTH } = require('../services/chatbotService');

/**
 * Strip characters that have no place in a chat message and could be
 * used for injection attempts (e.g. embedded HTML/script tags). This is
 * a defense-in-depth measure -- the frontend also escapes output before
 * rendering it (see public/script.js).
 * @param {string} input
 */
function sanitize(input) {
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // strip control chars
    .trim();
}

function validateChatRequest(req, res, next) {
  const { message } = req.body || {};

  if (message === undefined || message === null) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'The "message" field is required.',
    });
  }

  if (typeof message !== 'string') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'The "message" field must be a string.',
    });
  }

  const sanitized = sanitize(message);

  if (sanitized.length === 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'The "message" field cannot be empty.',
    });
  }

  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: 'ValidationError',
      message: `The "message" field cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  req.body.message = sanitized;
  next();
}

module.exports = { validateChatRequest, sanitize };
