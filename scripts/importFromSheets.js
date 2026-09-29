// One-time migration: reads the existing Google Sheet data and writes it into
// Firestore. Run locally: `node scripts/importFromSheets.js`.
//
// Prerequisites (manual, one-time):
//   1. A service-account JSON key with:
//        - Viewer access to the source Google Sheet (share the sheet with the
//          service account's email), for the Sheets API reads.
//        - Firestore/Cloud Datastore User role on the Firebase project, for
//          the Admin SDK writes.
//   2. Two env vars pointing at that key and the source spreadsheet:
//        GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//        SHEETS_SPREADSHEET_ID=1lpQ502MZlt8sUyOlgirGozD05Gs1N8B6QEJdVxHNoDs
//   3. `npm install googleapis firebase-admin` in this scripts/ dir (or reuse
//      functions/node_modules — firebase-admin is already a dependency there).
const { google } = require("googleapis");
const admin = require("firebase-admin");

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
  console.error("Set SHEETS_SPREADSHEET_ID to the source Google Sheet ID.");
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

// Mirrors Code.gs's HEADER_MAPPING so header text in either language is
// accepted, and getMappedKey()'s reverse lookup.
const HEADER_MAPPING = {
  ID: ["ID", "id"],
  ชื่อเด็ก: ["ชื่อเด็ก", "ชื่อ"],
  อายุ: ["อายุ"],
  บ้านเลขที่: ["บ้านเลขที่", "บ้าน"],
  หมู่: ["หมู่", "หมู่ที่"],
  ชื่อหมู่บ้าน: ["ชื่อหมู่บ้าน", "หมู่บ้าน", "village"],
  ตำบล: ["ตำบล", "Subdistrict", "subdistrict", "Tambon", "tambon"],
  อำเภอ: ["อำเภอ", "District", "district", "Amphoe", "amphoe"],
  จังหวัด: ["จังหวัด", "Province", "province"],
  Latitude: ["Lat", "Latitude", "lat", "latitude"],
  Longitude: ["Lng", "Longitude", "lng", "longitude"],
  "Hct (%)": ["Hct", "Hct (%)", "hct"],
  "น้ำหนัก (กก.)": ["น้ำหนัก(กก.)", "น้ำหนัก (กก.)", "น้ำหนัก"],
  "ส่วนสูง (ซม.)": ["ส่วนสูง(ซม.)", "ส่วนสูง (ซม.)", "ส่วนสูง"],
  สถานะโภชนาการ: ["สถานะโภชนาการ", "โภชนาการ"],
  ได้รับยาเหล็ก: ["ได้รับยาเหล็ก", "ยาเหล็ก"],
  พฤติกรรมการกินอาหาร: ["พฤติกรรมการกินอาหาร", "อาหาร"],
  ปัจจัยสังคมเศรษฐกิจ: ["ปัจจัยสังคมเศรษฐกิจ", "สังคม"],
  ผู้ดูแล: ["ผู้ดูแล"],
  "คะแนน Hct": ["คะแนน Hct"],
  คะแนนน้ำหนัก: ["คะแนนน้ำหนัก"],
  คะแนนยาเหล็ก: ["คะแนนยาเหล็ก"],
  คะแนนอาหาร: ["คะแนนอาหาร"],
  คะแนนสังคม: ["คะแนนสังคม"],
  คะแนนรวม: ["คะแนนรวม"],
  ระดับความเสี่ยง: ["สถานะ", "ระดับความเสี่ยง"],
  วันที่กินยาล่าสุด: ["วันที่กินยาล่าสุด"],
  หมายเหตุ: ["หมายเหตุ", "Notes", "notes", "Note", "note"],
  Active: ["Active", "active"]
};

function colIndex(headers, key) {
  const aliases = HEADER_MAPPING[key] || [key];
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

async function readSheet(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
  return res.data.values || [];
}

async function commitInChunks(items, toWrite) {
  let batch = db.batch();
  let count = 0;
  const commits = [];
  for (const item of items) {
    toWrite(batch, item);
    count++;
    if (count >= 450) { commits.push(batch.commit()); batch = db.batch(); count = 0; }
  }
  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function migrateChildren(sheets) {
  const rows = await readSheet(sheets, "ข้อมูลเด็ก");
  if (rows.length < 2) { console.log("children: no rows"); return; }
  const headers = rows[0];
  const idx = {
    id: colIndex(headers, "ID"), name: colIndex(headers, "ชื่อเด็ก"), age: colIndex(headers, "อายุ"),
    house: colIndex(headers, "บ้านเลขที่"), moo: colIndex(headers, "หมู่"), village: colIndex(headers, "ชื่อหมู่บ้าน"),
    tambon: colIndex(headers, "ตำบล"), amphoe: colIndex(headers, "อำเภอ"), province: colIndex(headers, "จังหวัด"),
    lat: colIndex(headers, "Latitude"), lng: colIndex(headers, "Longitude"), hct: colIndex(headers, "Hct (%)"),
    weight: colIndex(headers, "น้ำหนัก (กก.)"), height: colIndex(headers, "ส่วนสูง (ซม.)"),
    nutrition: colIndex(headers, "สถานะโภชนาการ"), iron: colIndex(headers, "ได้รับยาเหล็ก"),
    food: colIndex(headers, "พฤติกรรมการกินอาหาร"), social: colIndex(headers, "ปัจจัยสังคมเศรษฐกิจ"),
    guardian: colIndex(headers, "ผู้ดูแล"), hctScore: colIndex(headers, "คะแนน Hct"), nutrScore: colIndex(headers, "คะแนนน้ำหนัก"),
    ironScore: colIndex(headers, "คะแนนยาเหล็ก"), foodScore: colIndex(headers, "คะแนนอาหาร"), socialScore: colIndex(headers, "คะแนนสังคม"),
    totalScore: colIndex(headers, "คะแนนรวม"), status: colIndex(headers, "ระดับความเสี่ยง"), lastDate: colIndex(headers, "วันที่กินยาล่าสุด"),
    notes: colIndex(headers, "หมายเหตุ"), active: colIndex(headers, "Active")
  };

  const records = rows.slice(1)
    .filter((r) => idx.id !== -1 && r[idx.id])
    .map((r) => {
      const get = (i, fallback) => (i !== -1 && r[i] !== undefined && r[i] !== "" ? r[i] : fallback);
      const num = (v) => (v === undefined || v === "" || v === null ? null : Number(v));
      return {
        id: String(get(idx.id, "")).replace(/\.0$/, ""),
        name: get(idx.name, ""), age: get(idx.age, ""), house: String(get(idx.house, "")), moo: String(get(idx.moo, "")),
        village: get(idx.village, ""), tambon: get(idx.tambon, "คลองหาด"), amphoe: get(idx.amphoe, "คลองหาด"), province: get(idx.province, "สระแก้ว"),
        lat: num(get(idx.lat, null)), lng: num(get(idx.lng, null)), hct: num(get(idx.hct, null)),
        weight: num(get(idx.weight, null)), height: num(get(idx.height, null)),
        nutrition: get(idx.nutrition, ""), iron: get(idx.iron, ""), food: get(idx.food, ""), social: get(idx.social, ""),
        guardian: get(idx.guardian, ""), notes: get(idx.notes, ""),
        scores: {
          hct: Number(get(idx.hctScore, 0)) || 0, nutrition: Number(get(idx.nutrScore, 0)) || 0,
          iron: Number(get(idx.ironScore, 0)) || 0, food: Number(get(idx.foodScore, 0)) || 0, social: Number(get(idx.socialScore, 0)) || 0
        },
        totalScore: Number(get(idx.totalScore, 0)) || 0,
        status: get(idx.status, "เสี่ยงต่ำ"),
        lastDate: get(idx.lastDate, null) && get(idx.lastDate, null) !== "-" ? get(idx.lastDate, null) : null,
        active: idx.active === -1 || !(r[idx.active] === false || r[idx.active] === "false" || r[idx.active] === "FALSE")
      };
    });

  await commitInChunks(records, (batch, rec) => {
    batch.set(db.collection("children").doc(rec.id), { ...rec, migratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`children: migrated ${records.length} rows`);
}

async function migrateActivityLog(sheets) {
  const rows = await readSheet(sheets, "ActivityLog");
  if (rows.length < 2) { console.log("activityLog: no rows"); return; }
  const records = rows.slice(1).map((r) => ({
    timestamp: r[0] ? new Date(r[0]) : new Date(),
    user: r[1] || "", action: r[2] || "", details: r[3] || ""
  }));
  await commitInChunks(records, (batch, rec) => {
    batch.set(db.collection("activityLog").doc(), {
      timestamp: admin.firestore.Timestamp.fromDate(isNaN(rec.timestamp) ? new Date() : rec.timestamp),
      user: rec.user, action: rec.action, details: rec.details
    });
  });
  console.log(`activityLog: migrated ${records.length} rows`);
}

async function migrateMedicineLog(sheets) {
  const rows = await readSheet(sheets, "MedicineLog");
  if (rows.length < 2) { console.log("medicineLog: no rows"); return; }
  const records = rows.slice(1).map((r) => ({
    logId: r[0] || "", childId: r[1] || "", date: r[2] || "", taken: r[3] || "", vhvId: r[4] || "", time: r[5] || "", notes: r[6] || ""
  }));
  await commitInChunks(records, (batch, rec) => {
    const id = rec.logId || db.collection("medicineLog").doc().id;
    batch.set(db.collection("medicineLog").doc(id), { ...rec, migratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`medicineLog: migrated ${records.length} rows`);
}

// Users are keyed by Firebase Auth UID going forward (see functions/index.js
// linkOrCreateProfile), which doesn't exist yet for pre-migration rows. Writes
// them under their original sheet ID as an "unlinked" profile; the first real
// login (matched by email/phone/lineUserId) re-keys it to the real uid.
async function migrateUsers(sheets) {
  const rows = await readSheet(sheets, "Users");
  if (rows.length < 2) { console.log("users: no rows"); return; }
  const headers = rows[0];
  const idx = {
    id: headers.indexOf("ID"), name: headers.indexOf("Name"), role: headers.indexOf("Role"), email: headers.indexOf("Email"),
    lineUserId: headers.indexOf("LineUserId"), phone: headers.indexOf("Phone"),
    assignedVillage: headers.indexOf("AssignedVillage"), status: headers.indexOf("Status")
  };
  const records = rows.slice(1).filter((r) => idx.id !== -1 && r[idx.id]).map((r) => ({
    id: String(r[idx.id]),
    name: idx.name !== -1 ? r[idx.name] || "" : "",
    role: idx.role !== -1 ? r[idx.role] || "" : "",
    email: idx.email !== -1 ? r[idx.email] || "" : "",
    lineUserId: idx.lineUserId !== -1 ? r[idx.lineUserId] || "" : "",
    phone: idx.phone !== -1 ? r[idx.phone] || "" : "",
    assignedVillage: idx.assignedVillage !== -1 ? r[idx.assignedVillage] || "" : "",
    status: idx.status !== -1 ? r[idx.status] || "Active" : "Active"
  }));
  await commitInChunks(records, (batch, rec) => {
    const { id, ...data } = rec;
    batch.set(db.collection("users").doc(id), { ...data, migratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`users: migrated ${records.length} rows (unlinked — will re-key to a Firebase Auth uid on first login)`);
}

async function main() {
  const sheets = await getSheetsClient();
  await migrateChildren(sheets);
  await migrateActivityLog(sheets);
  await migrateMedicineLog(sheets);
  await migrateUsers(sheets);
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
