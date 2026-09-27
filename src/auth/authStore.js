const crypto = require('crypto');

const usersById = new Map();
const userIdsByEmail = new Map();
const sessions = new Map();
const chatSessions = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function passwordsMatch(password, user) {
  const derived = hashPassword(password, user.passwordSalt).hash;
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function createUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (userIdsByEmail.has(normalizedEmail)) {
    const error = new Error('An account with that email already exists.');
    error.code = 'EMAIL_EXISTS';
    throw error;
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date(),
  };
  usersById.set(user.id, user);
  userIdsByEmail.set(normalizedEmail, user.id);
  return user;
}

function verifyCredentials(email, password) {
  const userId = userIdsByEmail.get(normalizeEmail(email));
  const user = userId ? usersById.get(userId) : null;
  return user && passwordsMatch(password, user) ? user : null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

function getUserBySession(token) {
  const session = sessions.get(token);
  return session ? usersById.get(session.userId) || null : null;
}

function destroySession(token) {
  sessions.delete(token);
}

function linkChatSession(sessionId, userId) {
  if (sessionId) chatSessions.set(sessionId, userId);
}

function getUserIdForChatSession(sessionId) {
  return chatSessions.get(sessionId) || null;
}

module.exports = {
  createUser,
  verifyCredentials,
  createSession,
  getUserBySession,
  destroySession,
  linkChatSession,
  getUserIdForChatSession,
  normalizeEmail,
  _users: usersById,
  _sessions: sessions,
};