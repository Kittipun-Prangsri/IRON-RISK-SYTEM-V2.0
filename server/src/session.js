// Stateless signed-cookie sessions: "<base64url(json)>.<hmac>".
// The cookie carries only the user id + expiry; the user row is re-read on
// every request, so disabling a user in the DB takes effect immediately.
const crypto = require("crypto");
const { config } = require("./config");

const SESSION_COOKIE = "irs_session";

function hmac(body) {
  return crypto.createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

function verify(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(hmac(body));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq > 0) {
      const key = part.slice(0, eq).trim();
      try { out[key] = decodeURIComponent(part.slice(eq + 1).trim()); } catch (err) { /* ignore malformed */ }
    }
  });
  return out;
}

function cookieOptions(maxAgeMs) {
  return { httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/", maxAge: maxAgeMs };
}

// Short-lived signed value in its own cookie (OAuth state, post-login flash message).
function setSignedCookie(res, name, value, maxAgeMs) {
  res.cookie(name, sign({ v: value, exp: Date.now() + maxAgeMs }), cookieOptions(maxAgeMs));
}

function readSignedCookie(req, name) {
  const payload = verify(parseCookies(req)[name]);
  return payload ? payload.v : null;
}

function clearCookie(res, name) {
  res.clearCookie(name, { path: "/", sameSite: "lax", secure: config.cookieSecure, httpOnly: true });
}

function startSession(res, userId) {
  setSignedCookie(res, SESSION_COOKIE, { uid: userId }, config.sessionHours * 3600 * 1000);
}

function readSession(req) {
  const value = readSignedCookie(req, SESSION_COOKIE);
  return value && value.uid ? value : null;
}

function endSession(res) {
  clearCookie(res, SESSION_COOKIE);
}

module.exports = { startSession, readSession, endSession, setSignedCookie, readSignedCookie, clearCookie, sign, verify };
