const path = require("path");
const express = require("express");
const { config } = require("./config");
const users = require("./users");
const { handlers, PROVIDER_STATE_COOKIE, finishLogin } = require("./rpc");
const { ForbiddenError } = require("./children");
const { renderIndex } = require("./page");
const { fetchProviderProfile, displayName, LoginError } = require("./auth/providerId");
const { fetchLineProfile } = require("./auth/line");
const { readSession, endSession, setSignedCookie, readSignedCookie, clearCookie } = require("./session");

const FLASH_COOKIE = "irs_flash";

// Brute-force guard: counts FAILED logins per (IP, username) — successful
// logins don't count, so many staff behind one hospital NAT IP aren't blocked.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const loginFailures = new Map();

function failureKey(ip, identifier) {
  return `${ip}|${String(identifier || "").toLowerCase()}`;
}

function recentFailures(key) {
  const now = Date.now();
  const recent = (loginFailures.get(key) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (recent.length) loginFailures.set(key, recent); else loginFailures.delete(key);
  return recent;
}

function recordLoginFailure(key) {
  loginFailures.set(key, recentFailures(key).concat(Date.now()));
}

async function currentUser(req) {
  const session = readSession(req);
  if (!session) return null;
  const user = await users.findUser("id", session.uid);
  return user && user.status === "Active" ? user : null;
}

// Result of an OAuth callback travels to "/" in a short-lived signed cookie,
// then becomes the LINE_SESSION_USER / LINE_SESSION_ERROR page values.
function flash(res, payload) {
  setSignedCookie(res, FLASH_COOKIE, payload, 60 * 1000);
}

async function completeSsoLogin(res, user, method) {
  const outcome = await finishLogin({ res }, user, method);
  if (outcome.success) flash(res, { user: outcome.user });
  else flash(res, { user: outcome.pending ? outcome.user : null, error: outcome.error });
}

// frontend: true  → web page, OAuth callbacks and /api (what users / Cloudflare hit)
// frontend: false → API only (/api/*, /healthz) for the backend port
function createApp({ frontend = true } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback"); // behind nginx on the same host

  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin" // keeps OAuth ?code= out of third-party Referer headers
    });
    next();
  });

  if (frontend) mountFrontend(app);
  mountApi(app);
  return app;
}

function mountFrontend(app) {
  app.use(express.static(path.join(__dirname, "..", "public"), { index: false }));

  // ── Provider ID (MOPH) callback ─────────────────────────────────────────
  app.get("/auth/healthid/callback", async (req, res) => {
    const expected = readSignedCookie(req, PROVIDER_STATE_COOKIE);
    clearCookie(res, PROVIDER_STATE_COOKIE);
    try {
      if (!req.query.code) throw new LoginError("ไม่พบ authorization code จาก Health ID");
      if (!expected || expected !== req.query.state) {
        throw new LoginError("การเข้าสู่ระบบด้วย Provider ID ไม่ถูกต้อง (state ไม่ตรงกัน) กรุณาลองใหม่");
      }
      const provider = await fetchProviderProfile(String(req.query.code));
      let user = await users.findUser("providerId", provider.provider_id);
      if (!user) {
        user = await users.registerPendingUser({ name: displayName(provider), providerId: provider.provider_id, source: "Provider ID" });
      }
      await completeSsoLogin(res, user, "Provider ID");
    } catch (err) {
      if (!(err instanceof LoginError)) console.error("[providerId callback]", err);
      flash(res, { error: err instanceof LoginError ? err.message : "เข้าสู่ระบบด้วย Provider ID ไม่สำเร็จ" });
    }
    res.redirect("/");
  });

  // ── "/" : LINE Login callback (?code=&state=state_...) or the app page ────
  app.get("/", async (req, res) => {
    if (req.query.code) {
      try {
        const profile = await fetchLineProfile(String(req.query.code));
        let user = await users.findUser("lineUserId", profile.userId);
        if (!user) {
          user = await users.registerPendingUser({ name: profile.displayName, lineUserId: profile.userId, source: "LINE" });
        }
        await completeSsoLogin(res, user, "LINE");
      } catch (err) {
        if (!(err instanceof LoginError)) console.error("[line callback]", err);
        flash(res, { error: err instanceof LoginError ? err.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ" });
      }
      return res.redirect("/");
    }

    const flashed = readSignedCookie(req, FLASH_COOKIE) || {};
    if (flashed.user || flashed.error) clearCookie(res, FLASH_COOKIE);
    res.set("Cache-Control", "no-store");
    res.type("html").send(renderIndex({ lineUser: flashed.user || null, lineError: flashed.error || null }));
  });

  app.get("/favicon.ico", (req, res) => res.status(204).end());
}

function mountApi(app) {
  // ── RPC: google.script.run replacement ─────────────────────────────────
  app.post("/api/rpc/:name", express.json({ limit: "5mb" }), async (req, res) => {
    const entry = Object.prototype.hasOwnProperty.call(handlers, req.params.name) ? handlers[req.params.name] : null;
    if (!entry) return res.status(404).json({ error: `ไม่พบฟังก์ชัน ${req.params.name}` });
    // Custom header forces a CORS preflight for cross-site callers (CSRF guard).
    if (req.get("X-Requested-With") !== "fetch") return res.status(403).json({ error: "Forbidden" });

    try {
      const user = await currentUser(req);
      if (entry.access !== "public" && !user) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบใหม่" });
      if (entry.access === "staff" && !users.isStaff(user)) {
        return res.status(403).json({ error: "เฉพาะเจ้าหน้าที่เท่านั้นที่ใช้งานส่วนนี้ได้" });
      }
      const args = Array.isArray(req.body && req.body.args) ? req.body.args : [];
      const isLogin = req.params.name === "verifyUserLogin";
      const failKey = isLogin ? failureKey(req.ip, args[1]) : null;
      if (isLogin && recentFailures(failKey).length >= MAX_FAILURES) {
        return res.status(429).json({ error: "เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" });
      }
      const result = await entry.fn({ req, res, user }, ...args);
      if (isLogin && result && !result.success && !result.pending) recordLoginFailure(failKey);
      res.json({ result: result === undefined ? null : result });
    } catch (err) {
      if (err instanceof ForbiddenError) return res.status(403).json({ error: err.message });
      if (err instanceof LoginError) return res.status(400).json({ error: err.message });
      console.error(`[rpc ${req.params.name}]`, err);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" });
    }
  });

  app.post("/api/logout", (req, res) => {
    endSession(res);
    res.json({ result: { success: true } });
  });

  app.get("/healthz", (req, res) => res.json({ ok: true }));
}

module.exports = { createApp };
