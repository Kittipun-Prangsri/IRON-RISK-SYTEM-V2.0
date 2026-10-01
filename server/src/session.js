const crypto = require('crypto');

// Stateless session: httpOnly cookie holding "<base64url payload>.<HMAC-SHA256>".
// The payload only carries the user id + expiry; the user row is re-read on every
// request so suspensions and role changes apply immediately.
const COOKIE_NAME = 'ir_session';
const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (at least 32 characters)');
  return s;
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx !== -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, createSessionToken(userId), {
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  readCookie,
  setSessionCookie,
  clearSessionCookie
};
