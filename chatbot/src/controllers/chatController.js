/**
 * chatController.js
 * ------------------
 * Handles HTTP request/response concerns for the chat API. Delegates all
 * actual NLP/business logic to chatbotService.
 */

const { v4: uuidv4 } = require('uuid');
const chatbotService = require('../services/chatbotService');

/**
 * Get an existing session ID from the request, or generate a new one.
 * The client is expected to send it back on subsequent requests via the
 * `x-session-id` header (see public/script.js).
 */
function resolveSessionId(req) {
  const headerSessionId = req.get('x-session-id');
  if (headerSessionId && typeof headerSessionId === 'string' && headerSessionId.length <= 100) {
    return headerSessionId;
  }
  return uuidv4();
}

async function postChat(req, res, next) {
  try {
    const sessionId = resolveSessionId(req);
    const { message } = req.body;

    const result = await chatbotService.processMessage(sessionId, message);

    res.set('x-session-id', sessionId);
    return res.status(200).json({
      reply: result.reply,
      intent: result.intent,
      confidence: result.confidence,
      entities: result.entities,
      task: result.task,
      changedTask: result.changedTask,
      tasks: result.tasks,
      sessionId: result.sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    const sessionId = resolveSessionId(req);
    chatbotService.resetSession(sessionId);
    return res.status(200).json({ message: 'Session cleared.', sessionId });
  } catch (err) {
    return next(err);
  }
}

function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { postChat, deleteSession, getHealth, resolveSessionId };
