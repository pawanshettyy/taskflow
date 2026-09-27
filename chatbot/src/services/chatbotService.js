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
const { generateReply: generateGeminiReply } = require('./geminiClient');
const { extractTaskTitle } = require('./taskActions');
const sessionStore = require('./sessionStore');

const MAX_MESSAGE_LENGTH = 500;
let taskCreator = null;

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
async function processMessage(sessionId, rawMessage) {
  const message = String(rawMessage || '').slice(0, MAX_MESSAGE_LENGTH);

  const context = sessionStore.getContext(sessionId);

  const { intent, confidence, alternatives } = classifyIntent(message);
  const entities = extractEntities(message);
  const isPendingTaskTitle = context.lastIntent === 'add_task' && intent === 'fallback';
  const effectiveIntent = isPendingTaskTitle ? 'add_task' : intent;
  let createdTask = null;

  let localReply = generateResponse({ intent, entities, context });
  if (effectiveIntent === 'add_task') {
    const title = extractTaskTitle(message) || (isPendingTaskTitle ? message.trim() : '');
    if (!title) {
      localReply = 'What task should I add?';
    } else if (taskCreator) {
      createdTask = taskCreator(title);
      localReply = `Added task: "${createdTask.title}".`;
    } else {
      localReply = 'Task creation is available from the TaskFlow app. What task should I add?';
    }
  }

  const reply = effectiveIntent === 'fallback'
    ? localReply
    : effectiveIntent === 'add_task'
      ? localReply
    : (await generateGeminiReply({ intent, message, referenceReply: localReply })) || localReply;

  sessionStore.updateContext(sessionId, { intent: effectiveIntent, entities, message, reply });

  return {
    reply,
    intent: effectiveIntent,
    confidence,
    entities,
    alternatives,
    task: createdTask,
    sessionId,
  };
}

/**
 * Configure the host application's task creation callback.
 * @param {(title: string) => { title: string }} creator
 */
function configureTaskCreator(creator) {
  taskCreator = typeof creator === 'function' ? creator : null;
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
  configureTaskCreator,
  MAX_MESSAGE_LENGTH,
};
