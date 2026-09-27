/**
 * sessionStore.js
 * ---------------
 * A minimal in-memory store for per-session conversation context, keyed
 * by a session ID (generated client-side and passed via the
 * `x-session-id` header).
 *
 * This is intentionally simple for the academic scope of this project:
 * an in-memory Map that is wiped whenever the server restarts, with a
 * basic TTL-based cleanup so memory doesn't grow unbounded.
 *
 * Upgrade path (documented in README "Future Scalability"):
 *   Replace this module's internals with a Redis or MongoDB-backed store
 *   so context survives server restarts and scales across multiple
 *   server instances. The public functions (getContext/updateContext)
 *   would keep the same signature, so no other module needs to change.
 */

const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS, 10) || 30 * 60 * 1000; // 30 min default

const sessions = new Map();

/**
 * Retrieve (or lazily create) the context object for a session.
 * @param {string} sessionId
 * @returns {{ lastIntent: string|null, lastEntities: object|null, history: Array, updatedAt: number }}
 */
function getContext(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }

  const fresh = {
    lastIntent: null,
    lastEntities: null,
    history: [],
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, fresh);
  return fresh;
}

/**
 * Update a session's context after processing a message.
 * @param {string} sessionId
 * @param {{ intent: string, entities: object, message: string, reply: string }} turn
 */
function updateContext(sessionId, turn) {
  const context = getContext(sessionId);
  context.lastIntent = turn.intent;
  context.lastEntities = turn.entities;
  context.history.push({
    message: turn.message,
    reply: turn.reply,
    intent: turn.intent,
    timestamp: Date.now(),
  });
  // Cap history length to avoid unbounded memory growth in long sessions.
  if (context.history.length > 20) {
    context.history.shift();
  }
  context.updatedAt = Date.now();
  sessions.set(sessionId, context);
  return context;
}

/**
 * Remove sessions that have been idle longer than SESSION_TTL_MS.
 * Runs periodically (see the interval below).
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, context] of sessions.entries()) {
    if (now - context.updatedAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes. `unref()` so this timer never keeps the
// Node process alive on its own (helpful for tests/CLI usage).
const cleanupInterval = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Clear a single session's context (used by the "clear chat" feature).
 * @param {string} sessionId
 */
function clearContext(sessionId) {
  sessions.delete(sessionId);
}

module.exports = {
  getContext,
  updateContext,
  clearContext,
  cleanupExpiredSessions,
  _sessions: sessions, // exported for testing only
};
