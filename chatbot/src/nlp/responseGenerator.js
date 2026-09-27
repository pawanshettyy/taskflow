/**
 * responseGenerator.js
 * --------------------
 * Selects a response for a given intent, optionally adjusting it based on
 * conversation context (e.g. a "pricing" question right after a
 * "services" question) and extracted entities (e.g. a specific service
 * name, or an order ID for order-status queries).
 */

const intentsData = require('../data/intents.json');

const intentMap = new Map(intentsData.intents.map((i) => [i.tag, i]));

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generate a reply for the given classification result.
 * @param {object} params
 * @param {string} params.intent
 * @param {object} params.entities - output of entityExtractor.extractEntities
 * @param {object} params.context - session context: { lastIntent, lastEntities }
 * @returns {string}
 */
function generateResponse({ intent, entities, context }) {
  if (intent === 'fallback' || !intentMap.has(intent)) {
    return pickRandom(intentsData.fallbackResponses);
  }

  const intentDef = intentMap.get(intent);

  // --- Contextual overrides -------------------------------------------------

  // "How much does it cost?" right after asking about services.
  if (intent === 'pricing' && context && context.lastIntent === 'services') {
    return 'Since you asked about our services: pricing starts at $499 and depends on scope (e.g. web development vs. consulting). Want a tailored quote?';
  }

  // Pricing question that names a specific service, e.g. "cost of web development".
  if (intent === 'pricing' && entities && entities.services && entities.services.length > 0) {
    return `For ${entities.services[0]}, pricing typically starts at $499 depending on requirements. Would you like a detailed quote?`;
  }

  // Order status with an order ID already provided.
  if (intent === 'order_status' && entities && entities.orderIds && entities.orderIds.length > 0) {
    return `Let me check order ${entities.orderIds[0]}... (Note: this demo doesn't connect to a real order database yet, but in production this is where we'd query it.)`;
  }

  // Complaint that also includes contact info -- acknowledge we'll follow up.
  if (intent === 'complaint' && entities && entities.emails && entities.emails.length > 0) {
    return `I'm sorry for the trouble. We'll follow up at ${entities.emails[0]} as soon as possible. Could you also describe the issue in a bit more detail?`;
  }

  return pickRandom(intentDef.responses);
}

module.exports = { generateResponse };
