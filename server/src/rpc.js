// Server-side replacements for every Code.gs function the frontend calls via
// google.script.run. Each entry declares who may call it:
//   public — no session needed (login + pre-login settings)
//   user   — any Active user;  staff — เจ้าหน้าที่ รพ. / admin only
const crypto = require("crypto");
const { config } = require("./config");
const { query } = require("./db");
const children = require("./children");
const users = require("./users");
const { verifyHosxpLogin } = require("./auth/hosxp");
const { buildAuthUrl } = require("./auth/providerId");
const { startSession, setSignedCookie } = require("./session");

const PROVIDER_STATE_COOKIE = "irs_pid_state";
const SETTING_KEYS = ["lineClientId", "lineRedirectUri", "liffId"];

async function readSettings() {
  const rows = await query("SELECT k, v FROM settings");
  return rows.reduce((acc, r) => { acc[r.k] = r.v; return acc; }, {});
}

async function publicSettings() {
  const stored = await readSettings();
  return {
    lineClientId: stored.lineClientId || config.line.clientId,
    lineRedirectUri: stored.lineRedirectUri || config.line.redirectUri,
    liffId: stored.liffId || config.line.liffId,
    scriptUrl: `${config.publicBaseUrl}/`
  };
}

// ── LOGIN ────────────────────────────────────────────────────────────────
async function loginWithHosxp(ctx, loginname, password) {
  const result = await verifyHosxpLogin(loginname, password);
  if (!result.ok) return { success: false, error: result.error };
  let user = await users.findUser("hosxpLogin", result.loginname);
  if (!user) {
    user = await users.registerPendingUser({ name: result.name, hosxpLogin: result.loginname, source: "HOSxP" });
  }
  return finishLogin(ctx, user, "HOSxP");
}

async function finishLogin(ctx, user, method) {
  const outcome = users.loginResult(user);
  if (outcome.success) {
    startSession(ctx.res, user.id);
    await users.logActivity("เข้าสู่ระบบ", `เข้าสู่ระบบผ่าน ${method}`, users.userLabel(user));
  }
  return outcome;
}

const DISABLED_METHODS = {
  OTP: "การเข้าสู่ระบบด้วย OTP ยังไม่เปิดใช้บนเซิร์ฟเวอร์โรงพยาบาล (ยังไม่มีระบบส่ง SMS ยืนยันรหัส) กรุณาใช้บัญชี HOSxP, Provider ID หรือ LINE Login",
  LINE: "กรุณาใช้ปุ่ม \"เข้าสู่ระบบด้วย LINE Login\" (การยืนยันผ่าน LIFF ยังไม่เปิดใช้บนเซิร์ฟเวอร์โรงพยาบาล)"
};

async function verifyUserLogin(ctx, loginType, identifier, password) {
  if (DISABLED_METHODS[loginType]) return { success: false, error: DISABLED_METHODS[loginType] };
  if (loginType !== "SSO") return { success: false, error: "ไม่รองรับวิธีเข้าสู่ระบบนี้" };

  // Mock SSO buttons / dev quick-login send an email with no password.
  if (!password) {
    if (!config.devLogin) return { success: false, error: "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน HOSxP หรือใช้ Provider ID" };
    return finishLogin(ctx, await users.findUser("email", identifier), "Dev Login");
  }
  return loginWithHosxp(ctx, String(identifier || "").trim(), String(password));
}

// ── HANDLERS ─────────────────────────────────────────────────────────────
const handlers = {
  verifyUserLogin: { access: "public", fn: verifyUserLogin },

  // GAS read the Google session; there is no Google session on this server.
  getGoogleUser: { access: "public", fn: async () => ({ success: false, error: "ไม่รองรับ Google SSO บนเซิร์ฟเวอร์โรงพยาบาล" }) },

  getProviderIdAuthUrl: {
    access: "public",
    fn: async (ctx) => {
      const state = `pid_${crypto.randomBytes(16).toString("hex")}`;
      setSignedCookie(ctx.res, PROVIDER_STATE_COOKIE, state, 10 * 60 * 1000);
      return buildAuthUrl(state);
    }
  },

  getSystemSettings: {
    access: "public",
    fn: async (ctx) => {
      const settings = await publicSettings();
      if (users.isStaff(ctx.user)) {
        settings.spreadsheetId = "";
        settings.hasLineClientSecret = !!config.line.clientSecret;
      }
      return settings; // never includes secrets
    }
  },

  saveSystemSettings: {
    access: "staff",
    fn: async (ctx, s) => {
      const input = s || {};
      for (const key of SETTING_KEYS) {
        if (input[key] !== undefined) {
          await query("INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [key, String(input[key])]);
        }
      }
      await users.logActivity("แก้ไขการตั้งค่าระบบ", "อัปเดตการตั้งค่าระบบ", users.userLabel(ctx.user));
      const warnings = [];
      if (input.lineClientSecret || input.lineToken) warnings.push("Secret ต่างๆ ตั้งค่าในไฟล์ .env บนเซิร์ฟเวอร์เท่านั้น");
      return { success: true, warnings };
    }
  },

  // LINE Notify was discontinued by LINE (31 Mar 2025).
  testLineNotify: { access: "staff", fn: async () => ({ success: false, error: "LINE Notify ปิดให้บริการแล้ว (31 มี.ค. 2568)" }) },

  getData: { access: "user", fn: (ctx) => children.getData(ctx.user) },
  saveChild: { access: "user", fn: (ctx, childData) => children.saveChild(ctx.user, childData) },
  saveMedicineLog: { access: "user", fn: (ctx, logData) => children.saveMedicineLog(ctx.user, logData) },
  deleteChild: { access: "staff", fn: (ctx, id) => children.deleteChild(ctx.user, id) },
  saveChildrenBatch: { access: "staff", fn: (ctx, list) => children.saveChildrenBatch(ctx.user, list) },

  getUsersList: {
    access: "staff",
    fn: async () => (await query("SELECT * FROM users ORDER BY created_at, id")).map(users.rowToUser)
  },

  saveUserRecord: {
    access: "staff",
    fn: async (ctx, u) => {
      const data = u || {};
      const id = data.id ? String(data.id) : users.newUserId("USR");
      const existing = await users.findUser("id", id);
      const merged = { ...(existing || {}), ...data, id };
      await query(
        `INSERT INTO users (id, name, role, email, line_user_id, phone, assigned_village, status, provider_id, hosxp_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, email = EXCLUDED.email,
           line_user_id = EXCLUDED.line_user_id, phone = EXCLUDED.phone, assigned_village = EXCLUDED.assigned_village,
           status = EXCLUDED.status, provider_id = EXCLUDED.provider_id, hosxp_login = EXCLUDED.hosxp_login`,
        [id, merged.name || "", merged.role || "", merged.email || "", merged.lineUserId || "", merged.phone || "",
          merged.assignedVillage || "", merged.status || "Active", merged.providerId || null, merged.hosxpLogin || null]
      );
      await users.logActivity(existing ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน",
        `${existing ? "อัปเดตข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}: ${merged.name}`, users.userLabel(ctx.user));
      return { success: true, id };
    }
  }
};

module.exports = { handlers, publicSettings, PROVIDER_STATE_COOKIE, finishLogin };
