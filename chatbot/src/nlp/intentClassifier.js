/**
 * intentClassifier.js
 * -------------------
 * Trains a Naive Bayes classifier (from the `natural` library) on the
 * example patterns defined in src/data/intents.json, and exposes a
 * function to classify new user messages into an intent + confidence
 * score.
 *
 * Why Naive Bayes for a starter project?
 *  - It requires no external API or GPU.
 *  - It trains instantly (milliseconds) on small datasets.
 *  - It's easy to explain to students: it estimates
 *    P(intent | words) using P(words | intent) * P(intent) via Bayes' rule.
 *  - It is trivially replaceable later with a transformer/LLM-based
 *    classifier without changing any other module (see README's
 *    "Future Scalability" section).
 */

const natural = require('natural');
const intentsData = require('../data/intents.json');
const { preprocess, buildVocabulary } = require('./preprocessor');

// `natural`'s BayesClassifier.getClassifications() returns each label's raw
// joint probability P(class) * P(words|class) -- NOT a normalized P(class|
// words). These joint values never sum to 1 across classes (they're
// typically in the 0.01-0.2 range even for a confident, correct match), so
// comparing them directly against a 0-1 "confidence" threshold like the
// previous 0.35 default meant almost everything was misclassified as
// "fallback". We turn them into a real posterior probability ourselves via
// Bayes' rule (P(class|words) = joint(class) / sum(joint(all classes))),
// which is what the rest of the app actually expects a "confidence" to be.
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.10;

// Build a vocabulary from every training pattern up front. This is used
// for lightweight spell-correction before classification.
const trainingSentences = intentsData.intents.flatMap((intent) => intent.patterns);
const vocabulary = buildVocabulary(trainingSentences);

const classifier = new natural.BayesClassifier();

function train() {
  intentsData.intents.forEach((intent) => {
    intent.patterns.forEach((pattern) => {
      const { cleanedText } = preprocess(pattern, vocabulary);
      if (cleanedText) {
        classifier.addDocument(cleanedText, intent.tag);
      }
    });
  });
  classifier.train();
}

train();

/**
 * Convert raw classifier scores (unnormalized joint probabilities) into
 * proper posterior probabilities that sum to 1 across all classes.
 * @param {Array<{label: string, value: number}>} classifications
 * @returns {Array<{label: string, value: number}>}
 */
function normalizeClassifications(classifications) {
  const total = classifications.reduce((sum, c) => sum + c.value, 0);
  if (!total) return classifications.map((c) => ({ label: c.label, value: 0 }));
  return classifications.map((c) => ({ label: c.label, value: c.value / total }));
}

/**
 * Classify a raw user message into an intent.
 * @param {string} message
 * @returns {{
 *   intent: string,
 *   confidence: number,
 *   cleanedText: string,
 *   alternatives: Array<{label: string, value: number}>
 * }}
 */
function classifyIntent(message) {
  const { cleanedText } = preprocess(message, vocabulary);

  if (!cleanedText) {
    return { intent: 'fallback', confidence: 0, cleanedText: '', alternatives: [] };
  }

  const commandIntent = classifyTaskCommand(message);
  if (commandIntent) {
    return { intent: commandIntent, confidence: 1, cleanedText, alternatives: [] };
  }

  const rawClassifications = classifier.getClassifications(cleanedText) || [];

  if (rawClassifications.length === 0) {
    return { intent: 'fallback', confidence: 0, cleanedText, alternatives: [] };
  }

  const classifications = normalizeClassifications(rawClassifications);

  const top = classifications[0];
  const confidence = Number(top.value.toFixed(4));

  const intent = confidence >= CONFIDENCE_THRESHOLD ? top.label : 'fallback';

  return {
    intent,
    confidence,
    cleanedText,
    alternatives: classifications.slice(0, 3).map((c) => ({
      label: c.label,
      value: Number(c.value.toFixed(4)),
    })),
  };
}

function classifyTaskCommand(message) {
  const text = String(message || '').trim();
  if (/^(?:please\s+)?(?:add|create|make)\s+(?:a\s+)?task\b/i.test(text)) return 'add_task';
  if (/^(?:please\s+)?(?:reschedule|postpone|move|update|change)\s+(?:the\s+)?task\b/i.test(text)) return 'reschedule_task';
  if (/^(?:please\s+)?(?:complete|finish|check off|mark)\s+(?:the\s+|a\s+)?task\b/i.test(text)) return 'complete_task';
  if (/^(?:please\s+)?(?:delete|remove|get rid of)\s+(?:the\s+)?task\b/i.test(text)) return 'delete_task';
  return null;
}

/**
 * Expose the known intent tags (useful for validation/testing/UI hints).
 * @returns {string[]}
 */
function getAvailableIntents() {
  return intentsData.intents.map((i) => i.tag);
}

module.exports = {
  classifyIntent,
  getAvailableIntents,
  CONFIDENCE_THRESHOLD,
};
