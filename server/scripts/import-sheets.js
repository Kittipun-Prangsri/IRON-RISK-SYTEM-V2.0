// One-time migration: Google Sheets (exported as CSV) → MySQL.
// In Google Sheets, open each tab → File → Download → Comma-separated values (.csv), then:
//   node scripts/import-sheets.js --children "ข้อมูลเด็ก.csv" --users Users.csv \
//        --medicine MedicineLog.csv --activity ActivityLog.csv [--dry-run]
// Re-running is safe: rows are upserted by ID (activity log rows are appended).
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { transaction, close } = require("../src/db");
const { scoreChild } = require("../src/scoring");
const { toSqlDateTime } = require("../src/format");

// Column aliases, copied from Code.gs HEADER_MAPPING (canonical → accepted headers).
const CHILD_COLUMNS = {
  id: ["ID", "id"],
  name: ["ชื่อเด็ก", "ชื่อ"],
  age: ["อายุ"],
  house: ["บ้านเลขที่", "บ้าน"],
  moo: ["หมู่", "หมู่ที่"],
  village: ["ชื่อหมู่บ้าน", "หมู่บ้าน", "village"],
  tambon: ["ตำบล", "Subdistrict", "subdistrict", "Tambon", "tambon"],
  amphoe: ["อำเภอ", "District", "district", "Amphoe", "amphoe"],
  province: ["จังหวัด", "Province", "province"],
  lat: ["Lat", "Latitude", "lat", "latitude"],
  lng: ["Lng", "Longitude", "lng", "longitude"],
  hct: ["Hct", "Hct (%)", "hct"],
  weight: ["น้ำหนัก(กก.)", "น้ำหนัก (กก.)", "น้ำหนัก"],
  height: ["ส่วนสูง(ซม.)", "ส่วนสูง (ซม.)", "ส่วนสูง"],
  nutrition: ["สถานะโภชนาการ", "โภชนาการ"],
  iron: ["ได้รับยาเหล็ก", "ยาเหล็ก"],
  food: ["พฤติกรรมการกินอาหาร", "อาหาร"],
  social: ["ปัจจัยสังคมเศรษฐกิจ", "สังคม"],
  guardian: ["ผู้ดูแล"],
  lastDate: ["วันที่กินยาล่าสุด"],
  notes: ["หมายเหตุ", "Notes", "notes", "Note", "note"],
  active: ["Active", "active"],
  wkt: ["WKT", "wkt"]
};

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  return parse(text, { columns: (header) => header.map((h) => String(h).trim()), skip_empty_lines: true, relax_column_count: true });
}

function pick(row, aliases) {
  for (const a of aliases) {
    if (row[a] !== undefined && String(row[a]).trim() !== "") return String(row[a]).trim();
  }
  return "";
}

function num(v) {
  if (v === "" || v === undefined) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Sheets exports dates as displayed: "5/6/2026", "05/06/2026 8:30:00", "2026-06-05".
// Thai-locale sheets may use Buddhist years (e.g. 2569) — converted to CE.
function parseDate(value) {
  const s = String(value || "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) return build(+m[3], +m[2], +m[1], m[4], m[5], m[6]);
  return null;

  function build(y, mo, d, h, mi, se) {
    if (y > 2400) y -= 543;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const pad = (n) => String(n || 0).padStart(2, "0");
    return { date: `${y}-${pad(mo)}-${pad(d)}`, time: h !== undefined ? `${pad(h)}:${pad(mi)}` : "", sql: `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(se)}` };
  }
}

function childFromRow(row, index) {
  const c = {};
  Object.keys(CHILD_COLUMNS).forEach((k) => { c[k] = pick(row, CHILD_COLUMNS[k]); });
  // Some sheets only carry coordinates as WKT: "POINT (lng lat)".
  if ((!c.lat || !c.lng) && c.wkt) {
    const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(c.wkt);
    if (m) { c.lng = m[1]; c.lat = m[2]; }
  }
  const parsedLast = parseDate(c.lastDate);
  return {
    id: String(c.id || `IMPORT_${index + 1}`).replace(/\.0$/, ""),
    name: c.name, age: c.age, house: c.house, moo: c.moo, village: c.village,
    tambon: c.tambon || "คลองหาด", amphoe: c.amphoe || "คลองหาด", province: c.province || "สระแก้ว",
    lat: num(c.lat), lng: num(c.lng), hct: num(c.hct), weight: num(c.weight), height: num(c.height),
    nutrition: c.nutrition, iron: c.iron, food: c.food, social: c.social, guardian: c.guardian,
    lastDate: parsedLast ? parsedLast.date : (c.lastDate || "-"),
    notes: c.notes,
    active: !(c.active && String(c.active).toLowerCase() === "false")
  };
}

async function importChildren(conn, rows) {
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = childFromRow(rows[i], i);
    if (!c.name) continue; // blank / trailing rows
    const { scores, totalScore, status } = scoreChild(c); // recomputed with the current rules
    await conn.query(
      `INSERT INTO children (id, name, age, house, moo, village, tambon, amphoe, province, lat, lng, hct, weight, height,
         nutrition, iron, food, social, guardian, score_hct, score_nutrition, score_iron, score_food, score_social,
         total_score, status, last_date, notes, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), age = VALUES(age), house = VALUES(house), moo = VALUES(moo),
         village = VALUES(village), tambon = VALUES(tambon), amphoe = VALUES(amphoe), province = VALUES(province),
         lat = VALUES(lat), lng = VALUES(lng), hct = VALUES(hct), weight = VALUES(weight), height = VALUES(height),
         nutrition = VALUES(nutrition), iron = VALUES(iron), food = VALUES(food), social = VALUES(social),
         guardian = VALUES(guardian), score_hct = VALUES(score_hct), score_nutrition = VALUES(score_nutrition),
         score_iron = VALUES(score_iron), score_food = VALUES(score_food), score_social = VALUES(score_social),
         total_score = VALUES(total_score), status = VALUES(status), last_date = VALUES(last_date),
         notes = VALUES(notes), active = VALUES(active)`,
      [c.id, c.name, c.age, c.house, c.moo, c.village, c.tambon, c.amphoe, c.province, c.lat, c.lng, c.hct, c.weight, c.height,
        c.nutrition, c.iron, c.food, c.social, c.guardian, scores.hct, scores.nutrition, scores.iron, scores.food, scores.social,
        totalScore, status, c.lastDate, c.notes, c.active ? 1 : 0]
    );
    count++;
  }
  return count;
}

async function importUsers(conn, rows) {
  let count = 0;
  for (const r of rows) {
    const id = pick(r, ["ID", "id"]);
    if (!id) continue;
    const email = pick(r, ["Email", "email"]);
    // MOPH users registered by the GAS version stored their identifier in Email.
    const providerId = /^[0-9A-Za-z]{13}$/.test(email) && !email.includes("@") ? email : null;
    await conn.query(
      `INSERT INTO users (id, name, role, email, line_user_id, phone, assigned_village, status, provider_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), email = VALUES(email),
         line_user_id = VALUES(line_user_id), phone = VALUES(phone), assigned_village = VALUES(assigned_village),
         status = VALUES(status), provider_id = COALESCE(VALUES(provider_id), provider_id)`,
      [id, pick(r, ["Name", "name"]), pick(r, ["Role", "role"]) || "รอการอนุมัติ", providerId ? "" : email,
        pick(r, ["LineUserId", "lineUserId"]), pick(r, ["Phone", "phone"]), pick(r, ["AssignedVillage", "assignedVillage"]),
        pick(r, ["Status", "status"]) || "Active", providerId]
    );
    count++;
  }
  return count;
}

async function importMedicine(conn, rows) {
  let count = 0;
  for (const r of rows) {
    const logId = pick(r, ["Log ID", "LogID", "logId"]);
    const childId = pick(r, ["Child ID", "ChildID", "childId"]);
    if (!logId || !childId) continue;
    const d = parseDate(pick(r, ["Date", "date"]));
    await conn.query(
      `INSERT INTO medicine_log (log_id, child_id, log_date, log_time, taken, vhv_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE child_id = VALUES(child_id), log_date = VALUES(log_date), log_time = VALUES(log_time),
         taken = VALUES(taken), vhv_id = VALUES(vhv_id), notes = VALUES(notes)`,
      [logId, childId, d ? d.date : pick(r, ["Date", "date"]), pick(r, ["Time", "time"]), pick(r, ["Taken", "taken"]),
        pick(r, ["VHV ID", "VhvId", "vhvId"]), pick(r, ["Notes", "notes"])]
    );
    count++;
  }
  return count;
}

async function importActivity(conn, rows) {
  let count = 0;
  let undated = 0;
  for (const r of rows) {
    const raw = pick(r, ["Timestamp", "timestamp"]);
    const d = parseDate(raw);
    if (!d) undated++;
    await conn.query("INSERT INTO activity_log (ts, user, action, details) VALUES (?, ?, ?, ?)",
      [d ? d.sql : toSqlDateTime(new Date()), pick(r, ["User", "user"]) || "system", pick(r, ["Action", "action"]),
        pick(r, ["Details", "details"]) + (d || !raw ? "" : ` [เวลาเดิม: ${raw}]`)]);
    count++;
  }
  return { count, undated };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.children && !args.users && !args.medicine && !args.activity) {
    console.log("Usage: node scripts/import-sheets.js --children <csv> --users <csv> --medicine <csv> --activity <csv> [--dry-run]");
    process.exit(1);
  }
  const summary = await transaction(async (conn) => {
    const out = {};
    if (args.users) out.users = await importUsers(conn, readCsv(args.users));
    if (args.children) out.children = await importChildren(conn, readCsv(args.children));
    if (args.medicine) out.medicine = await importMedicine(conn, readCsv(args.medicine));
    if (args.activity) out.activity = await importActivity(conn, readCsv(args.activity));
    if (args.dryRun) throw Object.assign(new Error("dry-run"), { summary: out });
    return out;
  }).catch((err) => {
    if (err.message === "dry-run") { console.log("DRY RUN (rolled back):"); return err.summary; }
    throw err;
  });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().then(close).catch((err) => { console.error("Import failed:", err.message); close().finally(() => process.exit(1)); });
}

module.exports = { parseDate, childFromRow, readCsv };
