// Users + activity log repository. Row shape returned to the frontend matches
// the old "Users" sheet keys (id, name, role, email, lineUserId, phone,
// assignedVillage, status) so the existing UI works unchanged.
const crypto = require("crypto");
const { query } = require("./db");
const { toSqlDateTime } = require("./format");

const ROLE_STAFF = ["เจ้าหน้าที่ รพ.", "admin"];
const ROLE_VHV = "อสม.";
const ROLE_PENDING = "รอการอนุมัติ";

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    email: r.email,
    lineUserId: r.line_user_id,
    phone: r.phone,
    assignedVillage: r.assigned_village,
    status: r.status,
    providerId: r.provider_id || "",
    hosxpLogin: r.hosxp_login || ""
  };
}

const LOOKUP_COLUMNS = { id: "id", providerId: "provider_id", hosxpLogin: "hosxp_login", lineUserId: "line_user_id", email: "email" };

async function findUser(field, value) {
  const column = LOOKUP_COLUMNS[field];
  if (!column) throw new Error(`Unknown user lookup field: ${field}`);
  if (value === undefined || value === null || value === "") return null;
  const rows = await query(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`, [value]);
  return rowToUser(rows[0]);
}

function newUserId(prefix) {
  return `${prefix}${Date.now()}${crypto.randomInt(100, 999)}`;
}

// Auto-registers an unknown SSO user as Pending (staff approves later) —
// same behaviour as the GAS autoRegisterMophUser / autoRegisterLineUser.
async function registerPendingUser({ name, providerId, hosxpLogin, lineUserId, source }) {
  const id = newUserId("USR");
  await query(
    `INSERT INTO users (id, name, role, status, provider_id, hosxp_login, line_user_id)
     VALUES (?, ?, ?, 'Pending', ?, ?, ?)`,
    [id, name || "ผู้ใช้ใหม่", ROLE_PENDING, providerId || null, hosxpLogin || null, lineUserId || ""]
  );
  await logActivity("ลงทะเบียน", `Auto-register ผู้ใช้ใหม่ผ่าน ${source} รอการอนุมัติ: ${name}`, providerId || hosxpLogin || lineUserId || id);
  return findUser("id", id);
}

// Maps a user's status to the { success | pending | error } shape the frontend expects.
function loginResult(user) {
  if (!user) return { success: false, error: "ไม่พบบัญชีผู้ใช้งานในระบบ" };
  if (user.status === "Pending") {
    return { success: false, pending: true, user, error: "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ" };
  }
  if (user.status !== "Active") {
    return { success: false, error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }
  return { success: true, user };
}

function isStaff(user) {
  return !!user && ROLE_STAFF.indexOf(user.role) !== -1;
}

function isVhv(user) {
  return !!user && user.role === ROLE_VHV;
}

// A VHV with an assigned village only sees / edits that village.
function villageScope(user) {
  if (isVhv(user) && user.assignedVillage && user.assignedVillage !== "ทั้งหมด") return user.assignedVillage;
  return null;
}

function userLabel(user) {
  return (user && (user.email || user.name || user.id)) || "system";
}

async function logActivity(action, details, who, conn) {
  const run = conn ? (sql, params) => conn.query(sql, params) : query;
  await run("INSERT INTO activity_log (ts, user, action, details) VALUES (?, ?, ?, ?)",
    [toSqlDateTime(new Date()), who || "system", action, details || ""]);
}

module.exports = {
  ROLE_STAFF, ROLE_VHV, ROLE_PENDING,
  rowToUser, findUser, registerPendingUser, loginResult,
  isStaff, isVhv, villageScope, userLabel, logActivity, newUserId
};
