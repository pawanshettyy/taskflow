/**
 * Extract a task title from a natural-language add-task request.
 * @param {string} message
 * @returns {string}
 */
function extractTaskTitle(message) {
  const match = String(message || '').match(
    /^(?:please\s+)?(?:add|create|make)\s+(?:a\s+)?task(?:\s+(?:for\s+me|called|named|to|:))?\s*(.*?)\s*[.!?]*$/i
  );

  if (match && match[1].trim()) return match[1].trim();

  const reminderMatch = String(message || '').match(/^\s*(?:please\s+)?remind\s+me\s+to\s+(.+?)\s*[.!?]*$/i);
  return reminderMatch ? reminderMatch[1].trim() : '';
}

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function extractDueDate(message, now = new Date()) {
  const text = String(message || '');
  const explicit = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (explicit) {
    const date = new Date(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3]));
    if (date.getFullYear() === Number(explicit[1]) && date.getMonth() === Number(explicit[2]) - 1 && date.getDate() === Number(explicit[3])) {
      return explicit[0];
    }
  }

  const relative = text.toLowerCase();
  const offset = relative.includes('tomorrow') ? 1 : relative.includes('next week') ? 7 : relative.includes('today') ? 0 : null;
  if (offset !== null) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return toDateString(date);
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekday = weekdays.findIndex((day) => new RegExp(`\\b(?:on\\s+)?${day}\\b`, 'i').test(text));
  if (weekday !== -1) {
    const date = new Date(now);
    const daysAhead = (weekday - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + daysAhead);
    return toDateString(date);
  }

  return null;
}

function extractTaskDetails(message) {
  const text = String(message || '').trim();
  const extractedTitle = extractTaskTitle(text);
  const isIncompleteAddCommand = /^(?:please\s+)?(?:add|create|make)\s+(?:a\s+)?task(?:\s+for\s+me)?\s*[.!?]*$/i.test(text);
  const rawTitle = extractedTitle || (isIncompleteAddCommand ? '' : text);
  const dueDate = extractDueDate(message);
  const title = dueDate
    ? rawTitle
      .replace(/\s+(?:due\s+)?(?:on\s+)?20\d{2}-\d{2}-\d{2}\b/i, '')
      .replace(/\s+(?:due\s+)?(?:on\s+)?(?:today|tomorrow|next week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, '')
      .replace(/[,.!?]+$/, '')
      .trim()
    : rawTitle;
  return { title, dueDate };
}

function extractTaskReference(message, action) {
  const prefixes = {
    complete_task: /^(?:please\s+)?(?:complete|finish|check off|mark)\s+(?:the\s+|a\s+)?(?:task\s*)?(?:as\s+done\s*)?/i,
    delete_task: /^(?:please\s+)?(?:delete|remove|get rid of)\s+(?:the\s+)?(?:task\s*)?/i,
  };
  const prefix = prefixes[action];
  if (!prefix) return '';

  return String(message || '').replace(prefix, '').replace(/^[:#\s]+/, '').replace(/[.!?]+$/, '').trim();
}

module.exports = { extractTaskTitle, extractTaskReference, extractDueDate, extractTaskDetails };