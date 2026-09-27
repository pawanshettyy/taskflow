const authStore = require('./authStore');

const SESSION_COOKIE = 'taskflow_session';

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const pair = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.trim().slice(name.length + 1)) : null;
}

function attachUser(req, res, next) {
  req.user = authStore.getUserBySession(readCookie(req, SESSION_COOKIE));
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.redirect('/auth/login');
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

module.exports = {
  SESSION_COOKIE,
  attachUser,
  requireAuth,
  readCookie,
  setSessionCookie,
  clearSessionCookie,
};