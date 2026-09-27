const authStore = require('./authStore');

const SESSION_COOKIE = 'taskflow_session';
const CSRF_COOKIE = 'taskflow_csrf';

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const pair = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.trim().slice(name.length + 1)) : null;
}

function attachUser(req, res, next) {
  req.user = authStore.getUserBySession(readCookie(req, SESSION_COOKIE));
  req.csrfToken = readCookie(req, CSRF_COOKIE);
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.redirect('/auth/login');
}

function setSessionCookie(res, token) {
  const cookies = [
    `${SESSION_COOKIE}=${encodeURIComponent(token.token)}; HttpOnly; Path=/; SameSite=Lax`,
    `${CSRF_COOKIE}=${encodeURIComponent(token.csrfToken)}; Path=/; SameSite=Lax`,
  ];
  res.setHeader('Set-Cookie', cookies);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
  ]);
}

function requireCsrf(req, res, next) {
  const sessionToken = readCookie(req, SESSION_COOKIE);
  const suppliedToken = req.get('x-csrf-token') || req.body?._csrf;
  if (authStore.verifyCsrfToken(sessionToken, suppliedToken)) return next();
  return res.status(403).send('Forbidden: invalid CSRF token.');
}

module.exports = {
  SESSION_COOKIE,
  CSRF_COOKIE,
  attachUser,
  requireAuth,
  readCookie,
  setSessionCookie,
  clearSessionCookie,
  requireCsrf,
};