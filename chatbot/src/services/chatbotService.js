/**
 * chatbotService.js
 * -----------------
 * The orchestration layer that ties the NLP pipeline together:
 *   preprocessing -> intent classification -> entity extraction ->
 *   context lookup -> response generation -> context update.
 *
 * This is the single place the controller talks to, keeping HTTP
 * concerns (req/res) completely separate from NLP/business logic.
 */

const { classifyIntent } = require('../nlp/intentClassifier');
const { extractEntities } = require('../nlp/entityExtractor');
const { generateResponse } = require('../nlp/responseGenerator');
const sessionStore = require('./sessionStore');

const MAX_MESSAGE_LENGTH = 500;

/**
 * Process an incoming chat message end-to-end.
 * @param {string} sessionId
 * @param {string} rawMessage
 * @returns {{
 *   reply: string,
 *   intent: string,
 *   confidence: number,
 *   entities: object,
 *   alternatives: Array,
 *   sessionId: string
 * }}
 */
function processMessage(sessionId, rawMessage) {
  const message = String(rawMessage || '').slice(0, MAX_MESSAGE_LENGTH);

  const context = sessionStore.getContext(sessionId);

  const { intent, confidence, alternatives } = classifyIntent(message);
  const entities = extractEntities(message);

  const reply = generateResponse({ intent, entities, context });

  sessionStore.updateContext(sessionId, { intent, entities, message, reply });

  return {
    reply,
    intent,
    confidence,
    entities,
    alternatives,
    sessionId,
  };
}

/**
 * Clear the conversation context for a session ("Clear chat" button).
 * @param {string} sessionId
 */
function resetSession(sessionId) {
  sessionStore.clearContext(sessionId);
}

module.exports = {
  processMessage,
  resetSession,
  MAX_MESSAGE_LENGTH,
};
