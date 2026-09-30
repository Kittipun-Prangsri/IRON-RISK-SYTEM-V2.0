// HOSxP account login against the opduser table imported into Supabase.
// Assumes the standard `opduser` table: loginname, name, passweb, and optionally
// account_disable ('Y' = disabled). passweb storage varies by site/version —
// set HOSXP_PASSWORD_HASH (md5 | plain) to match, and verify with the HOSxP admin.
const crypto = require("crypto");
const { query } = require("../db");
const { config } = require("../config");

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

  try {
    const res = await query('SELECT loginname, name, passweb, account_disable FROM "opduser_Ncd" WHERE loginname = $1 LIMIT 1', [loginname]);
    const row = res.rows[0];
    
    // Same message for unknown user / wrong password (no account enumeration).
    if (!row || !passwordMatches(password, row.passweb)) {
      return { ok: false, error: "ชื่อผู้ใช้งานหรือรหัสผ่าน HOSxP ไม่ถูกต้อง" };
    }
    if (String(row.account_disable || "").toUpperCase() === "Y") {
      return { ok: false, error: "บัญชี HOSxP นี้ถูกปิดการใช้งาน" };
    }
    return { ok: true, loginname: row.loginname, name: row.name || row.loginname };
  } catch (err) {
    if (err.code === '42P01') { // PostgreSQL: undefined_table
      return { ok: false, error: "ไม่พบตาราง opduser_Ncd ในฐานข้อมูล กรุณาตรวจสอบชื่อตารางใน Supabase อีกครั้ง" };
    }
    console.error("[hosxp login error]", err);
    return { ok: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล HOSxP" };
  }
}

async function closeHosxp() {
  // No longer needed, managed by main db pool
}

module.exports = { verifyHosxpLogin, passwordMatches, closeHosxp };
