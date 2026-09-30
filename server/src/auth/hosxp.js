// HOSxP account login against the hospital's HOSxP database (read-only user).
// Assumes the standard `opduser` table: loginname, name, passweb, and optionally
// account_disable ('Y' = disabled). passweb storage varies by site/version —
// set HOSXP_PASSWORD_HASH (md5 | plain) to match, and verify with the HOSxP admin.
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { config } = require("../config");

let pool = null;

function getHosxpPool() {
  if (!pool) {
    const h = config.hosxp;
    pool = mysql.createPool({
      host: h.host, port: h.port, user: h.user, password: h.password, database: h.database,
      charset: "utf8mb4", waitForConnections: true, connectionLimit: 3
    });
  }
  return pool;
}

function passwordMatches(input, stored) {
  if (stored === undefined || stored === null || stored === "") return false;
  const expected = String(stored);
  const actual = config.hosxp.passwordHash === "plain"
    ? String(input)
    : crypto.createHash("md5").update(String(input), "utf8").digest("hex");
  const a = Buffer.from(actual.toUpperCase());
  const b = Buffer.from(expected.toUpperCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Returns { ok: true, loginname, name } or { ok: false, error }.
async function verifyHosxpLogin(loginname, password) {
  if (!config.hosxp.enabled) return { ok: false, error: "ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยบัญชี HOSxP (HOSXP_ENABLED)" };
  if (!loginname || !password) return { ok: false, error: "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน HOSxP" };

  const [rows] = await getHosxpPool().query("SELECT * FROM opduser WHERE loginname = ? LIMIT 1", [loginname]);
  const row = rows[0];
  // Same message for unknown user / wrong password (no account enumeration).
  if (!row || !passwordMatches(password, row.passweb)) {
    return { ok: false, error: "ชื่อผู้ใช้งานหรือรหัสผ่าน HOSxP ไม่ถูกต้อง" };
  }
  if (String(row.account_disable || "").toUpperCase() === "Y") {
    return { ok: false, error: "บัญชี HOSxP นี้ถูกปิดการใช้งาน" };
  }
  return { ok: true, loginname: row.loginname, name: row.name || row.loginname };
}

async function closeHosxp() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { verifyHosxpLogin, passwordMatches, closeHosxp };
