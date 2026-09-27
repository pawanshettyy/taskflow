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
const { extractTaskDetails, extractTaskReference, extractRescheduleDetails } = require('./taskActions');
const sessionStore = require('./sessionStore');

const MAX_MESSAGE_LENGTH = 500;
let taskCreator = null;
let taskActions = {};

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
  const isPendingTaskAction = ['complete_task', 'delete_task', 'reschedule_task'].includes(context.lastIntent) && intent === 'fallback';
  const effectiveIntent = isPendingTaskTitle
    ? 'add_task'
    : isPendingTaskAction
      ? context.lastIntent
      : intent;
  let createdTask = null;
  let changedTask = null;
  let listedTasks = null;

  let localReply = generateResponse({ intent, entities, context });
  if (effectiveIntent === 'add_task') {
    const details = extractTaskDetails(message);
    const title = details.title || (isPendingTaskTitle ? message.trim() : '');
    if (!title) {
      localReply = 'What task should I add?';
    } else if (taskCreator) {
      createdTask = taskCreator(title, details.dueDate, sessionId);
      localReply = createdTask
        ? `Added task: "${createdTask.title}".`
        : 'Please sign in to add tasks to your personal list.';
    } else {
      localReply = 'Task creation is available from the TaskFlow app. What task should I add?';
    }
  } else if (effectiveIntent === 'list_tasks') {
    if (!taskActions.list) {
      localReply = 'Task list actions are available from the TaskFlow app.';
    } else {
      listedTasks = taskActions.list(sessionId);
      localReply = listedTasks.length > 0
        ? `Your tasks: ${listedTasks.map((task) => task.dueDate ? `${task.title} (due ${task.dueDate})` : task.title).join(', ')}.`
        : 'You have no tasks yet.';
    }
  } else if (effectiveIntent === 'complete_task' || effectiveIntent === 'delete_task') {
    const reference = extractTaskReference(message, effectiveIntent) || (isPendingTaskAction ? message.trim() : '');
    const action = taskActions[effectiveIntent];
    if (!reference) {
      localReply = effectiveIntent === 'complete_task'
        ? 'Which task should I mark as complete?'
        : 'Which task should I remove?';
    } else if (!action) {
      localReply = 'Task actions are available from the TaskFlow app.';
    } else {
      changedTask = action(reference, sessionId);
      if (!changedTask) {
        localReply = `I couldn't find a task matching "${reference}".`;
      } else {
        localReply = effectiveIntent === 'complete_task'
          ? `Completed task: "${changedTask.title}".`
          : `Removed task: "${changedTask.title}".`;
      }
    }
  } else if (effectiveIntent === 'reschedule_task') {
    const details = extractRescheduleDetails(message);
    const reference = details.reference || (isPendingTaskAction ? message.trim() : '');
    if (!reference || !details.dueDate) {
      localReply = 'Which task should I reschedule, and what date should it have?';
    } else if (!taskActions.reschedule_task) {
      localReply = 'Task actions are available from the TaskFlow app.';
    } else {
      changedTask = taskActions.reschedule_task(reference, details.dueDate, sessionId);
      localReply = changedTask
        ? `Rescheduled task: "${changedTask.title}" to ${changedTask.dueDate}.`
        : `I couldn't find a task matching "${reference}".`;
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
    changedTask,
    tasks: listedTasks,
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

function configureTaskActions(actions) {
  taskActions = actions && typeof actions === 'object'
    ? {
      ...actions,
      complete_task: actions.complete_task || actions.complete,
      delete_task: actions.delete_task || actions.delete,
      reschedule_task: actions.reschedule_task || actions.reschedule,
    }
    : {};
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
  configureTaskActions,
  MAX_MESSAGE_LENGTH,
};
