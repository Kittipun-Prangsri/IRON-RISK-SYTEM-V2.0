// Child records + medicine log — ports of the GAS getData / saveChild /
// deleteChild / saveChildrenBatch / saveMedicineLog, keeping the same
// request/response shapes the frontend already uses.
const crypto = require("crypto");
const { query, transaction } = require("./db");
const { scoreChild } = require("./scoring");
const { logActivity, villageScope, userLabel } = require("./users");
const { toDisplayDateTime, sqlToDisplay } = require("./format");

// Frontend field → column. Everything the user can edit on a child record.
const EDITABLE = {
  name: "name", age: "age", house: "house", moo: "moo", village: "village",
  tambon: "tambon", amphoe: "amphoe", province: "province", lat: "lat", lng: "lng",
  hct: "hct", weight: "weight", height: "height", nutrition: "nutrition", iron: "iron",
  food: "food", social: "social", guardian: "guardian", lastDate: "last_date", notes: "notes"
};
const NUMERIC = ["lat", "lng", "hct", "weight", "height"];
const DEFAULTS = { tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lastDate: "-" };

class ForbiddenError extends Error {}

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToChild(r) {
  return {
    id: r.id, name: r.name, age: r.age, house: r.house, moo: r.moo, village: r.village,
    tambon: r.tambon, amphoe: r.amphoe, province: r.province,
    lat: toNumberOrNull(r.lat), lng: toNumberOrNull(r.lng), hct: toNumberOrNull(r.hct),
    weight: toNumberOrNull(r.weight), height: toNumberOrNull(r.height),
    nutrition: r.nutrition, iron: r.iron || "ไม่ได้", food: r.food, social: r.social,
    guardian: r.guardian, totalScore: Number(r.total_score) || 0, status: r.status,
    lastDate: r.last_date || "-", notes: r.notes || ""
  };
}

// Existing row (if any) + incoming fields → full record. Fields the client did
// not send keep their stored value instead of being blanked.
function mergeChild(existing, incoming) {
  const merged = existing ? rowToChild(existing) : {};
  Object.keys(EDITABLE).forEach((key) => {
    if (incoming[key] !== undefined) merged[key] = incoming[key];
    if ((merged[key] === undefined || merged[key] === "") && DEFAULTS[key] !== undefined) merged[key] = DEFAULTS[key];
  });
  return merged;
}

function childParams(id, child) {
  const { scores, totalScore, status } = scoreChild(child);
  const values = Object.keys(EDITABLE).map((key) => {
    if (NUMERIC.indexOf(key) !== -1) return toNumberOrNull(child[key]);
    return child[key] === undefined || child[key] === null ? "" : String(child[key]);
  });
  return {
    status, totalScore,
    params: [id, ...values, scores.hct, scores.nutrition, scores.iron, scores.food, scores.social, totalScore, status]
  };
}

const UPSERT_SQL = `
  INSERT INTO children (id, ${Object.values(EDITABLE).join(", ")},
    score_hct, score_nutrition, score_iron, score_food, score_social, total_score, status, active)
  VALUES (?, ${Object.keys(EDITABLE).map(() => "?").join(", ")}, ?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT (id) DO UPDATE SET ${Object.values(EDITABLE).map((c) => `${c} = EXCLUDED.${c}`).join(", ")},
    score_hct = EXCLUDED.score_hct, score_nutrition = EXCLUDED.score_nutrition, score_iron = EXCLUDED.score_iron,
    score_food = EXCLUDED.score_food, score_social = EXCLUDED.score_social, total_score = EXCLUDED.total_score,
    status = EXCLUDED.status, active = 1`;

function newChildId() {
  return `CHILD_${Date.now()}_${crypto.randomInt(100, 999)}`;
}

async function getData(user) {
  const village = villageScope(user);
  const children = await query(
    `SELECT * FROM children WHERE active = 1${village ? " AND village = ?" : ""} ORDER BY created_at, id`,
    village ? [village] : []
  );
  const logs = await query("SELECT ts, username, action, details FROM activity_log ORDER BY id DESC LIMIT 50");

  const result = {
    children: children.map(rowToChild),
    logs: logs.map((l) => ({ timestamp: sqlToDisplay(l.ts), user: l.username, action: l.action, details: l.details })),
    villages: {},
    userEmail: userLabel(user),
    sheetName: "MySQL (server โรงพยาบาล)",
    lastUpdated: toDisplayDateTime(new Date())
  };
  result.children.forEach((c) => {
    if (c.village) result.villages[c.village] = (result.villages[c.village] || 0) + 1;
  });
  return result;
}

async function saveChild(user, childData) {
  if (!childData || typeof childData !== "object") return { success: false, error: "ไม่พบข้อมูลเด็ก" };
  const village = villageScope(user);
  const id = childData.id ? String(childData.id) : newChildId();

  return transaction(async (conn) => {
    const rows = await conn.query("SELECT * FROM children WHERE id = ? FOR UPDATE", [id]);
    const existing = rows[0] || null;
    if (village && ((existing && existing.village !== village) || (childData.village !== undefined && childData.village !== village))) {
      throw new ForbiddenError("คุณสามารถบันทึกข้อมูลได้เฉพาะในหมู่บ้านที่รับผิดชอบ");
    }
    const merged = mergeChild(existing, childData);
    if (village && !merged.village) merged.village = village;
    const { params, status, totalScore } = childParams(id, merged);
    await conn.query(UPSERT_SQL, params);
    await logActivity(
      existing ? "แก้ไขข้อมูลเด็ก" : "เพิ่มข้อมูลเด็ก",
      `${existing ? "แก้ไขประวัติเด็ก" : "เพิ่มเด็กใหม่เข้าระบบ"}: ${merged.name} ID: ${id}`,
      userLabel(user), conn
    );
    return { success: true, id, status, totalScore };
  });
}

async function deleteChild(user, childId) {
  const rows = await query("SELECT name FROM children WHERE id = ? AND active = 1", [String(childId)]);
  if (!rows.length) return { success: false };
  await query("UPDATE children SET active = 0 WHERE id = ?", [String(childId)]);
  await logActivity("ลบข้อมูลเด็ก", `ทำการลบ (Soft Delete) เด็ก ID: ${childId} ชื่อ: ${rows[0].name}`, userLabel(user));
  return { success: true };
}

// CSV import: match by ID, else by exact name; blank cells never overwrite data.
async function saveChildrenBatch(user, list) {
  if (!Array.isArray(list)) return { success: false, error: "รูปแบบข้อมูลนำเข้าไม่ถูกต้อง" };
  return transaction(async (conn) => {
    const existingRows = await conn.query("SELECT * FROM children FOR UPDATE");
    const byId = new Map(existingRows.map((r) => [String(r.id), r]));
    const byName = new Map(existingRows.filter((r) => r.name).map((r) => [String(r.name).trim(), r]));

    let added = 0;
    let updated = 0;
    for (const raw of list) {
      let existing = null;
      if (raw.id) existing = byId.get(String(raw.id)) || null;
      else if (raw.name) existing = byName.get(String(raw.name).trim()) || null;

      const incoming = {};
      Object.keys(EDITABLE).forEach((k) => {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") incoming[k] = raw[k];
      });
      const id = existing ? existing.id : (raw.id ? String(raw.id) : newChildId());
      const merged = mergeChild(existing, incoming);
      await conn.query(UPSERT_SQL, childParams(id, merged).params);
      if (existing) updated++; else added++;
    }
    await logActivity("นำเข้าข้อมูลเด็ก (Batch)",
      `นำเข้าเด็กปฐมวัยจำนวน ${list.length} คน (เพิ่มใหม่ ${added}, อัปเดต ${updated})`, userLabel(user), conn);
    return { success: true, added, updated };
  });
}

async function saveMedicineLog(user, logData) {
  if (!logData || !logData.childId) return { success: false, error: "ไม่พบรหัสเด็ก" };
  const village = villageScope(user);
  const rows = await query("SELECT village FROM children WHERE id = ?", [String(logData.childId)]);
  if (!rows.length) return { success: false, error: "ไม่พบข้อมูลเด็ก" };
  if (village && rows[0].village !== village) throw new ForbiddenError("คุณสามารถบันทึกข้อมูลได้เฉพาะในหมู่บ้านที่รับผิดชอบ");

  const logId = `MED_${Date.now()}_${crypto.randomInt(100, 999)}`;
  await transaction(async (conn) => {
    await conn.query(
      "INSERT INTO medicine_log (log_id, child_id, log_date, log_time, taken, vhv_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [logId, String(logData.childId), logData.date || "", logData.time || "", logData.taken || "", logData.vhvId || user.id, logData.notes || ""]
    );
    if (logData.taken === "กินยาแล้ว" && /^\d{4}-\d{2}-\d{2}$/.test(logData.date || "")) {
      await conn.query("UPDATE children SET last_date = ? WHERE id = ?", [logData.date, String(logData.childId)]);
    }
    await logActivity("บันทึกเวลากินยา",
      `บันทึกการกินยาสำหรับเด็ก ID: ${logData.childId} วันที่: ${logData.date} สถานะ: ${logData.taken}`, userLabel(user), conn);
  });
  return { success: true, logId };
}

module.exports = { getData, saveChild, deleteChild, saveChildrenBatch, saveMedicineLog, ForbiddenError, rowToChild };
