const crypto = require('crypto');

const db = require('../db/database');
const SESSION_TTL_MS = parseInt(process.env.AUTH_SESSION_TTL_MS, 10) || 7 * 24 * 60 * 60 * 1000;

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
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  try {
    db.prepare(`
      INSERT INTO users (id, name, email, password_salt, password_hash, created_at)
      VALUES (@id, @name, @email, @passwordSalt, @passwordHash, @createdAt)
    `).run(user);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const duplicate = new Error('An account with that email already exists.');
      duplicate.code = 'EMAIL_EXISTS';
      throw duplicate;
    }
    throw error;
  }
  return user;
}

function verifyCredentials(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
  const user = row && {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
  return user && passwordsMatch(password, user) ? user : null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, csrf_token, created_at) VALUES (?, ?, ?, ?)').run(token, userId, csrfToken, new Date().toISOString());
  return { token, csrfToken };
}

function getSession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.created_at AS sessionCreatedAt, s.csrf_token AS csrfToken,
      u.id, u.name, u.email, u.created_at AS createdAt
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) || null;
  if (!row) return null;
  if (Date.now() - Date.parse(row.sessionCreatedAt) > SESSION_TTL_MS) {
    destroySession(token);
    return null;
  }
  return row;
}

function getUserBySession(token) {
  const session = getSession(token);
  if (!session) return null;
  return { id: session.id, name: session.name, email: session.email, createdAt: session.createdAt };
}

function getCsrfToken(token) {
  const session = getSession(token);
  return session ? session.csrfToken : null;
}

function verifyCsrfToken(token, suppliedToken) {
  const expected = getCsrfToken(token);
  if (!expected || !suppliedToken || expected.length !== suppliedToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(suppliedToken));
}

function changePassword(userId, currentPassword, newPassword) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const user = row && {
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
  };
  if (!user || !passwordsMatch(currentPassword, user)) return false;
  const { salt, hash } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(salt, hash, userId);
  return true;
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function linkChatSession(sessionId, userId) {
  if (!sessionId) return;
  db.prepare(`
    INSERT INTO chat_sessions (session_id, user_id, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at
  `).run(sessionId, userId, new Date().toISOString());
}

function getUserIdForChatSession(sessionId) {
  const row = db.prepare('SELECT user_id FROM chat_sessions WHERE session_id = ?').get(sessionId);
  return row ? row.user_id : null;
}

module.exports = {
  createUser,
  verifyCredentials,
  createSession,
  getUserBySession,
  getCsrfToken,
  verifyCsrfToken,
  changePassword,
  destroySession,
  linkChatSession,
  getUserIdForChatSession,
  normalizeEmail,
  _db: db,
};