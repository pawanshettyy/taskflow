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

module.exports = { extractTaskTitle };