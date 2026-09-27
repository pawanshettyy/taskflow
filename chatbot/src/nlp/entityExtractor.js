/**
 * entityExtractor.js
 * ------------------
 * Rule/regex-based entity extraction. For a starter academic project this
 * is far more predictable and explainable than a statistical NER model,
 * and it runs instantly with zero dependencies beyond the standard
 * library. It can later be swapped for a proper NER model (e.g. spaCy
 * via a microservice, or an LLM function-call) without touching any
 * other module -- see README's "Future Scalability" section.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const ORDER_ID_REGEX = /(?:#|order\s*(?:id|number)?\s*[:#]?\s*)(\w{4,12})/gi;
const MONEY_REGEX = /\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?/g;
const DATE_KEYWORDS = ['today', 'tomorrow', 'yesterday', 'tonight', 'next week', 'this week'];

// Keywords pulled from the intents dataset -- used to tag which
// product/service a message refers to, enabling contextual responses
// (e.g. "how much does web development cost?").
const SERVICE_KEYWORDS = ['web development', 'mobile app', 'app development', 'consulting', 'software consulting', 'design'];

/**
 * Extract structured entities from a raw (un-preprocessed) user message.
 * Extraction runs on the original text, not the stemmed/cleaned version,
 * because casing and punctuation matter for things like emails and IDs.
 * @param {string} message
 * @returns {{
 *   emails: string[],
 *   phones: string[],
 *   orderIds: string[],
 *   amounts: string[],
 *   dates: string[],
 *   services: string[]
 * }}
 */
function extractEntities(message) {
  const text = message || '';
  const lower = text.toLowerCase();

  const emails = [...text.matchAll(EMAIL_REGEX)].map((m) => m[0]);
  const phones = [...text.matchAll(PHONE_REGEX)].map((m) => m[0].trim()).filter((p) => p.replace(/\D/g, '').length >= 7);
  const orderIds = [...text.matchAll(ORDER_ID_REGEX)].map((m) => m[1]).filter(Boolean);
  const amounts = [...text.matchAll(MONEY_REGEX)].map((m) => m[0]);
  const dates = DATE_KEYWORDS.filter((keyword) => lower.includes(keyword));
  const services = SERVICE_KEYWORDS.filter((keyword) => lower.includes(keyword));

  return {
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    orderIds: [...new Set(orderIds)],
    amounts: [...new Set(amounts)],
    dates: [...new Set(dates)],
    services: [...new Set(services)],
  };
}

module.exports = { extractEntities };
