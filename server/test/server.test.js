// Integration tests: app DB = a throwaway PostgreSQL started by embedded-postgres
// (same engine as Supabase); HOSxP = mock "opduser" table in a local MySQL
// (iron_risk_hosxp_test). MOPH endpoints are stubbed.
// Run: npm test   (override MySQL credentials with TEST_DB_USER / TEST_DB_PASSWORD)
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const os = require("os");
const path = require("path");
const HOSXP_DB = "iron_risk_hosxp_test";
const PG_PORT = 54329;
const PG_PASSWORD = crypto.randomBytes(12).toString("hex");
Object.assign(process.env, {
  ENV_FILE: "/nonexistent/.env",
  NODE_ENV: "test",
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  DATABASE_URL: `postgres://postgres:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/iron_risk_test`, DB_SCHEMA: "iron_risk", DB_SSL: "false",
  HOSXP_ENABLED: "true", HOSXP_DB_HOST: "127.0.0.1", HOSXP_DB_USER: process.env.TEST_DB_USER || "root",
  HOSXP_DB_PASSWORD: process.env.TEST_DB_PASSWORD || "", HOSXP_DB_NAME: HOSXP_DB, HOSXP_PASSWORD_HASH: "md5",
  MOPH_ENV: "prd", HEALTHID_CLIENT_ID: "hid-client", HEALTHID_CLIENT_SECRET: "hid-secret",
  PROVIDERID_CLIENT_ID: "pid-client", PROVIDERID_SECRET_KEY: "pid-secret",
  DEV_LOGIN: "false"
});

const mysql = require("mysql2/promise");
const { createApp } = require("../src/app");
const { initDb } = require("../scripts/init-db");
const db = require("../src/db");
const { closeHosxp } = require("../src/auth/hosxp");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex").toUpperCase();
let server;
let base;
let pgServer;

// ── tiny HTTP client with a cookie jar ────────────────────────────────────
function jar() {
  const cookies = {};
  return {
    header() { return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "); },
    store(resp) {
      (resp.headers.getSetCookie ? resp.headers.getSetCookie() : []).forEach((c) => {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        const k = pair.slice(0, eq);
        const v = pair.slice(eq + 1);
        if (!v || /Expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k]; else cookies[k] = v;
      });
    },
    has(name) { return !!cookies[name]; }
  };
}

async function rpc(j, name, ...args) {
  const resp = await realFetch(`${base}/api/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", Cookie: j.header() },
    body: JSON.stringify({ args })
  });
  j.store(resp);
  return { status: resp.status, body: await resp.json() };
}

async function get(j, path) {
  const resp = await realFetch(`${base}${path}`, { headers: { Cookie: j.header() }, redirect: "manual" });
  j.store(resp);
  return { status: resp.status, location: resp.headers.get("location"), text: await resp.text() };
}

// ── MOPH stub (everything that isn't our own server) ──────────────────────
const realFetch = global.fetch;
const moph = { hasProviderId: true, calls: [] };
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  moph.calls.push(u);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (u === "https://moph.id.th/api/v1/token") {
    const form = new URLSearchParams(opts.body);
    if (form.get("code") !== "good-code") return json(422, { status: "fail", message: "Code is invalid" });
    return json(200, { status: "success", data: { access_token: "health-token" } });
  }
  if (u === "https://provider.id.th/api/v1/services/token") {
    if (!moph.hasProviderId) return json(400, { message: "This user has not provider id" });
    return json(200, { status: 200, data: { access_token: "provider-token" } });
  }
  if (u === "https://provider.id.th/api/v1/services/profile") {
    assert.equal(opts.headers.Authorization, "Bearer provider-token");
    return json(200, { status: 200, data: { provider_id: "0111111111X21", special_title_th: "นายแพทย์", name_th: "หมอพร้อม สงบสุข", organization: [{ hcode: "10999" }] } });
  }
  throw new Error(`unexpected external fetch ${u}`);
};

// ── setup / teardown ──────────────────────────────────────────────────────
test.before(async () => {
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  pgServer = new EmbeddedPostgres({
    databaseDir: path.join(os.tmpdir(), `iron-risk-pg-${process.pid}`),
    user: "postgres", password: PG_PASSWORD, port: PG_PORT, persistent: false, onLog: () => {},
    initdbFlags: ["--encoding=UTF8", "--locale=C"]
  });
  await pgServer.initialise();
  await pgServer.start();
  await pgServer.createDatabase("iron_risk_test");

  const admin = await mysql.createConnection({ host: "127.0.0.1", user: process.env.HOSXP_DB_USER, password: process.env.HOSXP_DB_PASSWORD, multipleStatements: true });
  await admin.query(`CREATE DATABASE IF NOT EXISTS ${HOSXP_DB} CHARACTER SET utf8mb4;`);
  await admin.query(`
    USE ${HOSXP_DB};
    DROP TABLE IF EXISTS opduser;
    CREATE TABLE opduser (loginname VARCHAR(64) PRIMARY KEY, name VARCHAR(255), passweb VARCHAR(64), account_disable CHAR(1));
    INSERT INTO opduser VALUES ('nurse1', 'พยาบาล ทดสอบ', '${md5("secret")}', 'N'), ('vhv1', 'อสม. ทดสอบ', '${md5("vhvpass")}', 'N'),
      ('newdoc', 'แพทย์ ใหม่', '${md5("doc")}', 'N'), ('gone', 'ลาออก', '${md5("x")}', 'Y');`);
  await admin.end();

  await initDb();
  for (const t of ["users", "children", "medicine_log", "activity_log", "settings"]) await db.query(`DELETE FROM ${t}`);
  await db.query(`INSERT INTO users (id, name, role, status, hosxp_login, assigned_village, email) VALUES
    ('ST001', 'พยาบาล ทดสอบ', 'เจ้าหน้าที่ รพ.', 'Active', 'nurse1', 'ทั้งหมด', 'nurse1@khh.local'),
    ('AOR001', 'อสม. ทดสอบ', 'อสม.', 'Active', 'vhv1', 'บ้านคลองหาด', '')`);

  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await db.close();
  await closeHosxp();
  await pgServer.stop();
});

// ── tests ─────────────────────────────────────────────────────────────────
test("GET / renders the GAS template with shim, partials and empty session values", async () => {
  const r = await get(jar(), "/");
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('<script src="/gas-shim.js"></script>'));
  assert.ok(!r.text.includes("<?!="), "all template tags resolved");
  assert.match(r.text, /id="line-session-user">null</);
});

test("RPC requires the X-Requested-With header and a session", async () => {
  const noHeader = await realFetch(`${base}/api/rpc/getData`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noHeader.status, 403);
  assert.equal((await rpc(jar(), "getData")).status, 401);
  assert.equal((await rpc(jar(), "noSuchFunction")).status, 404);
});

test("HOSxP login: wrong password, disabled account, success", async () => {
  const j = jar();
  const bad = await rpc(j, "verifyUserLogin", "SSO", "nurse1", "wrong");
  assert.equal(bad.body.result.success, false);
  assert.ok(!j.has("irs_session"));

  const disabled = await rpc(j, "verifyUserLogin", "SSO", "gone", "x");
  assert.match(disabled.body.result.error, /ปิดการใช้งาน/);

  const ok = await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  assert.equal(ok.body.result.success, true);
  assert.equal(ok.body.result.user.id, "ST001");
  assert.ok(j.has("irs_session"));
  assert.equal((await rpc(j, "getData")).status, 200);
});

test("unknown HOSxP user is auto-registered as Pending and gets no session", async () => {
  const j = jar();
  const r = await rpc(j, "verifyUserLogin", "SSO", "newdoc", "doc");
  assert.equal(r.body.result.pending, true);
  assert.equal(r.body.result.user.name, "แพทย์ ใหม่");
  assert.ok(!j.has("irs_session"));
  const again = await rpc(j, "verifyUserLogin", "SSO", "newdoc", "doc");
  assert.equal(again.body.result.user.id, r.body.result.user.id, "no duplicate registration");
});

test("OTP / passwordless SSO are refused without DEV_LOGIN", async () => {
  assert.match((await rpc(jar(), "verifyUserLogin", "OTP", "0811112222", "")).body.result.error, /OTP/);
  assert.equal((await rpc(jar(), "verifyUserLogin", "SSO", "nurse1@khh.local", "")).body.result.success, false);
});

test("saveChild scores like Code.gs and a partial update keeps other fields", async () => {
  const j = jar();
  await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  const saved = await rpc(j, "saveChild", {
    name: "ด.ญ. ทดสอบ", age: "2", village: "บ้านคลองหาด", hct: 29, nutrition: "ผอม", iron: "สม่ำเสมอ", food: "เป็นประจำ", social: "เพียงพอ", guardian: "แม่"
  }, "ignored@client");
  assert.equal(saved.body.result.success, true);
  assert.equal(saved.body.result.totalScore, 4);
  assert.equal(saved.body.result.status, "เสี่ยงสูง");

  await rpc(j, "saveChild", { id: saved.body.result.id, hct: 34 });
  const data = (await rpc(j, "getData")).body.result;
  const child = data.children.find((c) => c.id === saved.body.result.id);
  assert.equal(child.guardian, "แม่", "untouched field kept");
  assert.equal(child.hct, 34);
  assert.equal(child.totalScore, 2);
  assert.equal(child.status, "เสี่ยงปานกลาง");
  assert.equal(data.logs[0].user, "nurse1@khh.local", "log uses the session user, not the client-supplied label");
});

test("VHV only sees and edits their own village; staff-only functions are refused", async () => {
  const staff = jar();
  await rpc(staff, "verifyUserLogin", "SSO", "nurse1", "secret");
  await rpc(staff, "saveChild", { id: "C_OTHER", name: "เด็กหมู่อื่น", village: "บ้านเขาดิน" });
  await rpc(staff, "saveChild", { id: "C_MINE", name: "เด็กหมู่ตัวเอง", village: "บ้านคลองหาด" });

  const vhv = jar();
  assert.equal((await rpc(vhv, "verifyUserLogin", "SSO", "vhv1", "vhvpass")).body.result.success, true);
  const villages = new Set((await rpc(vhv, "getData")).body.result.children.map((c) => c.village));
  assert.deepEqual([...villages], ["บ้านคลองหาด"]);

  assert.equal((await rpc(vhv, "saveChild", { id: "C_OTHER", hct: 20 })).status, 403);
  assert.equal((await rpc(vhv, "saveChild", { name: "ย้ายหมู่", village: "บ้านเขาดิน" })).status, 403);
  assert.equal((await rpc(vhv, "saveChild", { id: "C_MINE", hct: 31 })).status, 200);
  assert.equal((await rpc(vhv, "getUsersList")).status, 403);
  assert.equal((await rpc(vhv, "deleteChild", "C_MINE")).status, 403);
  assert.equal((await rpc(vhv, "saveMedicineLog", { childId: "C_OTHER", date: "2026-09-30", time: "08:00", taken: "กินยาแล้ว" })).status, 403);
});

test("saveMedicineLog updates last date; deleteChild soft-deletes", async () => {
  const j = jar();
  await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  assert.equal((await rpc(j, "saveMedicineLog", { childId: "C_MINE", date: "2026-09-30", time: "08:15", taken: "กินยาแล้ว" })).body.result.success, true);
  let child = (await rpc(j, "getData")).body.result.children.find((c) => c.id === "C_MINE");
  assert.equal(child.lastDate, "2026-09-30");
  assert.equal((await rpc(j, "deleteChild", "C_MINE")).body.result.success, true);
  child = (await rpc(j, "getData")).body.result.children.find((c) => c.id === "C_MINE");
  assert.equal(child, undefined);
});

test("saveChildrenBatch matches by name and never blanks existing data", async () => {
  const j = jar();
  await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  const r = await rpc(j, "saveChildrenBatch", [
    { name: "เด็กหมู่อื่น", hct: "", weight: 12 },
    { name: "เด็กใหม่ CSV", village: "บ้านเขาดิน", hct: 31 }
  ]);
  assert.deepEqual([r.body.result.added, r.body.result.updated], [1, 1]);
  const kids = (await rpc(j, "getData")).body.result.children;
  assert.equal(kids.find((c) => c.id === "C_OTHER").weight, 12);
  assert.equal(kids.find((c) => c.name === "เด็กใหม่ CSV").totalScore, 1);
});

test("users: staff can list and approve; settings never leak secrets", async () => {
  const j = jar();
  await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  const list = (await rpc(j, "getUsersList")).body.result;
  const pending = list.find((u) => u.hosxpLogin === "newdoc");
  assert.equal(pending.status, "Pending");
  await rpc(j, "saveUserRecord", { ...pending, status: "Active", role: "เจ้าหน้าที่ รพ." });
  assert.equal((await rpc(jar(), "verifyUserLogin", "SSO", "newdoc", "doc")).body.result.success, true);

  const settings = JSON.stringify((await rpc(j, "getSystemSettings")).body.result);
  assert.ok(!/secret/i.test(settings.replace(/hasLineClientSecret/g, "")), "no secret values in settings");
});

test("Provider ID: state check, pending registration, then login after approval", async () => {
  const j = jar();
  const urlResp = await rpc(j, "getProviderIdAuthUrl");
  const authUrl = new URL(urlResp.body.result);
  assert.equal(authUrl.origin + authUrl.pathname, "https://moph.id.th/oauth/redirect");
  assert.equal(authUrl.searchParams.get("redirect_uri"), "http://localhost:3000/auth/healthid/callback");
  const state = authUrl.searchParams.get("state");

  // Forged callback (wrong state) is rejected before any MOPH call.
  const before = moph.calls.length;
  let r = await get(j, `/auth/healthid/callback?code=good-code&state=evil`);
  assert.equal(r.status, 302);
  assert.equal(moph.calls.length, before);
  assert.match((await get(j, "/")).text, /state ไม่ตรงกัน/);

  // Real flow → Pending.
  await rpc(j, "getProviderIdAuthUrl");
  const state2 = new URL((await rpc(j, "getProviderIdAuthUrl")).body.result).searchParams.get("state");
  assert.notEqual(state2, state);
  r = await get(j, `/auth/healthid/callback?code=good-code&state=${state2}`);
  assert.equal(r.location, "/");
  const page = (await get(j, "/")).text;
  assert.match(page, /"status":"Pending"/);
  assert.match(page, /นายแพทย์ หมอพร้อม สงบสุข/);
  assert.ok(!j.has("irs_session"));

  // Approve, log in again → session.
  const [row] = await db.query("SELECT id FROM users WHERE provider_id = '0111111111X21'");
  await db.query("UPDATE users SET status = 'Active', role = 'เจ้าหน้าที่ รพ.' WHERE id = ?", [row.id]);
  const state3 = new URL((await rpc(j, "getProviderIdAuthUrl")).body.result).searchParams.get("state");
  await get(j, `/auth/healthid/callback?code=good-code&state=${state3}`);
  assert.ok(j.has("irs_session"));
  assert.equal((await rpc(j, "getData")).status, 200);
  const count = await db.query("SELECT COUNT(*) AS n FROM users WHERE provider_id = '0111111111X21'");
  assert.equal(count[0].n, 1);
});

test("Provider ID: account without Provider ID gets a clear error", async () => {
  moph.hasProviderId = false;
  const j = jar();
  const state = new URL((await rpc(j, "getProviderIdAuthUrl")).body.result).searchParams.get("state");
  await get(j, `/auth/healthid/callback?code=good-code&state=${state}`);
  assert.match((await get(j, "/")).text, /ยังไม่มี Provider ID/);
  moph.hasProviderId = true;
});

test("logout clears the session; a disabled user loses access immediately", async () => {
  const j = jar();
  await rpc(j, "verifyUserLogin", "SSO", "nurse1", "secret");
  const r = await realFetch(`${base}/api/logout`, { method: "POST", headers: { Cookie: j.header() } });
  j.store(r);
  assert.equal((await rpc(j, "getData")).status, 401);

  const vhv = jar();
  await rpc(vhv, "verifyUserLogin", "SSO", "vhv1", "vhvpass");
  await db.query("UPDATE users SET status = 'Inactive' WHERE id = 'AOR001'");
  assert.equal((await rpc(vhv, "getData")).status, 401);
});

test("brute-force guard: 10 failures lock that username only; successes never count", async () => {
  await db.query("INSERT INTO users (id, name, role, status, hosxp_login) VALUES ('ST_BF', 'bf', 'เจ้าหน้าที่ รพ.', 'Active', 'newdoc') ON CONFLICT DO NOTHING");
  for (let i = 0; i < 10; i++) {
    assert.equal((await rpc(jar(), "verifyUserLogin", "SSO", "newdoc", "wrong")).status, 200);
  }
  const locked = await rpc(jar(), "verifyUserLogin", "SSO", "newdoc", "doc");
  assert.equal(locked.status, 429, "even the right password is refused while locked");

  for (let i = 0; i < 12; i++) {
    assert.equal((await rpc(jar(), "verifyUserLogin", "SSO", "nurse1", "secret")).body.result.success, true);
  }
});

test("Supabase API roles (anon / authenticated) cannot read the app schema", async () => {
  const { checkout } = db;
  const client = await checkout();
  try {
    await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; END IF; END $$");
    // Simulate Supabase's broad default grants, then re-run db:init — it must revoke them.
    await client.query("GRANT USAGE ON SCHEMA iron_risk TO anon, authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA iron_risk TO anon, authenticated");
    await initDb();
    for (const role of ["anon", "authenticated"]) {
      await client.query(`SET ROLE ${role}`);
      await assert.rejects(client.query("SELECT * FROM iron_risk.children"), /permission denied/);
      await client.query("RESET ROLE");
    }
  } finally {
    await client.query("RESET ROLE").catch(() => {});
    client.release();
  }
});
