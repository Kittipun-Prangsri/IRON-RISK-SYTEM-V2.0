const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const { scoreChild } = require("./lib/scoring");
const { requireAuth, requireProfile, requireStaff, isVhv } = require("./lib/auth");

const LINE_TOKEN = defineSecret("LINE_TOKEN");
const LINE_CLIENT_SECRET = defineSecret("LINE_CLIENT_SECRET");

// ── DATE FORMAT HELPERS (Asia/Bangkok, matches Code.gs Utilities.formatDate) ──
function formatDateTimeTH(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
function formatDateISO(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function logActivity(action, details, userLabel) {
  await db.collection("activityLog").add({
    timestamp: FieldValue.serverTimestamp(),
    user: userLabel || "system",
    action,
    details
  });
}

async function sendLineNotifyAlert(token, name, village, hct, score) {
  if (!token) return;
  const message = `\n🚨 [Iron Zero Risk - Alert] 🚨\nพบเด็กความเสี่ยงสูง (ต้องลงเยี่ยมบ้านด่วน!)\n👶 ชื่อ: ${name}\n📍 หมู่บ้าน: ${village}\n🩸 Hct: ${hct}%\n📊 คะแนนความเสี่ยง: ${score}/10 คะแนน\n──────────────────────\nกรุณาลงพื้นที่ติดตามการกินยาเสริมธาตุเหล็กทันที`;
  try {
    await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message })
    });
  } catch (err) {
    console.error("LINE Notify failed:", err);
  }
}

// Resolves a Firestore Auth uid to its `users` profile: direct hit, or a match on
// `matchField` (an unlinked profile pre-registered by staff, or a prior LINE/SSO
// login under a different doc id), or auto-provisions a new Pending profile —
// mirrors Code.gs's verifyUserLogin()/autoRegisterLineUser() lookup-then-register chain.
async function linkOrCreateProfile(uid, matchField, matchValue, defaults) {
  const directRef = db.collection("users").doc(uid);
  const directSnap = await directRef.get();
  if (directSnap.exists) return { id: uid, ...directSnap.data() };

  let matchSnap = null;
  if (matchField && matchValue) {
    const q = await db.collection("users").where(matchField, "==", matchValue).limit(1).get();
    if (!q.empty) matchSnap = q.docs[0];
  }

  if (matchSnap) {
    const merged = { ...matchSnap.data(), authUid: uid, linkedAt: FieldValue.serverTimestamp() };
    await directRef.set(merged, { merge: true });
    if (matchSnap.id !== uid) await matchSnap.ref.delete();
    return { id: uid, ...merged };
  }

  const created = {
    name: defaults.name || "ผู้ใช้ใหม่",
    role: "รอการอนุมัติ",
    email: defaults.email || "",
    lineUserId: defaults.lineUserId || "",
    phone: defaults.phone || "",
    assignedVillage: "",
    status: "Pending",
    authUid: uid,
    createdAt: FieldValue.serverTimestamp()
  };
  await directRef.set(created);
  await logActivity("ลงทะเบียน", `Auto-register ผู้ใช้ใหม่รอการอนุมัติ: ${created.name}`, defaults.email || defaults.lineUserId || uid);
  return { id: uid, ...created };
}

// ── AUTH: LINE LOGIN CODE EXCHANGE (public — this call establishes auth) ────
exports.exchangeLineLogin = onCall({ secrets: [LINE_CLIENT_SECRET] }, async (request) => {
  const code = request.data && request.data.code;
  if (!code) throw new HttpsError("invalid-argument", "ไม่พบ authorization code");

  const settingsSnap = await db.collection("settings").doc("public").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const clientId = settings.lineClientId || "";
  const redirectUri = settings.lineRedirectUri || "";
  const clientSecret = LINE_CLIENT_SECRET.value();

  if (!clientId || !clientSecret) {
    throw new HttpsError("failed-precondition", "ยังไม่ได้ตั้งค่า LINE Client ID/Secret ในระบบ");
  }

  const tokenResp = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const tokenData = await tokenResp.json();
  if (tokenData.error) {
    throw new HttpsError("unauthenticated", `LINE Token error: ${tokenData.error_description || tokenData.error}`);
  }

  const profileResp = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileResp.json();
  if (!profile.userId) {
    throw new HttpsError("internal", "ไม่สามารถดึงข้อมูล LINE Profile ได้");
  }

  const uid = `line_${profile.userId}`;
  const userProfile = await linkOrCreateProfile(uid, "lineUserId", profile.userId, {
    name: profile.displayName,
    lineUserId: profile.userId
  });

  const enriched = { ...userProfile, avatarUrl: profile.pictureUrl || "", displayName: profile.displayName || userProfile.name };

  if (userProfile.status === "Pending") {
    return { pending: true, user: enriched };
  }
  if (userProfile.status === "Inactive" || userProfile.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const customToken = await admin.auth().createCustomToken(uid);
  await logActivity("เข้าสู่ระบบ", "เข้าสู่ระบบผ่าน LINE", userProfile.email || userProfile.lineUserId);
  return { customToken, user: enriched };
});

// ── AUTH: RESOLVE/PROVISION PROFILE AFTER FIREBASE AUTH SIGN-IN (Google SSO) ─
exports.ensureUserProfile = onCall(async (request) => {
  const auth = requireAuth(request);
  const email = auth.token.email || "";
  const profile = await linkOrCreateProfile(auth.uid, email ? "email" : null, email, {
    name: auth.token.name || email,
    email
  });

  if (profile.status === "Pending") {
    return { success: false, pending: true, user: profile };
  }
  if (profile.status === "Inactive" || profile.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  await logActivity("เข้าสู่ระบบ", "เข้าสู่ระบบผ่าน Google SSO", profile.email || auth.uid);
  return { success: true, user: profile };
});

// ── DATA: GET ALL (dashboard bootstrap) ──────────────────────────────────
exports.getData = onCall(async (request) => {
  const profile = await requireProfile(request);

  let childrenQuery = db.collection("children").where("active", "==", true);
  if (isVhv(profile) && profile.assignedVillage) {
    childrenQuery = childrenQuery.where("village", "==", profile.assignedVillage);
  }
  const childrenSnap = await childrenQuery.get();

  const children = [];
  const villages = {};
  childrenSnap.forEach((doc) => {
    const c = doc.data();
    const lastDate = c.lastDate && c.lastDate.toDate ? formatDateISO(c.lastDate.toDate()) : (c.lastDate || "-");
    children.push({
      id: c.id || doc.id, name: c.name || "", age: c.age || "", house: c.house || "", moo: c.moo || "",
      village: c.village || "", tambon: c.tambon || "คลองหาด", amphoe: c.amphoe || "คลองหาด", province: c.province || "สระแก้ว",
      lat: c.lat ?? null, lng: c.lng ?? null, hct: c.hct ?? null, weight: c.weight ?? null, height: c.height ?? null,
      nutrition: c.nutrition || "", iron: c.iron || "ไม่ได้", food: c.food || "", social: c.social || "",
      guardian: c.guardian || "", totalScore: c.totalScore || 0, status: c.status || "เสี่ยงต่ำ",
      lastDate, notes: c.notes || ""
    });
    if (c.village) villages[c.village] = (villages[c.village] || 0) + 1;
  });

  const logsSnap = await db.collection("activityLog").orderBy("timestamp", "desc").limit(50).get();
  const logs = logsSnap.docs.map((doc) => {
    const l = doc.data();
    return {
      timestamp: l.timestamp && l.timestamp.toDate ? formatDateTimeTH(l.timestamp.toDate()) : String(l.timestamp || ""),
      user: l.user, action: l.action, details: l.details
    };
  });

  return {
    children, logs, villages,
    userEmail: profile.email || profile.name,
    sheetName: "Firestore",
    lastUpdated: formatDateTimeTH(new Date())
  };
});

// ── DATA: SAVE / DELETE / BATCH CHILD ─────────────────────────────────────
exports.saveChild = onCall({ secrets: [LINE_TOKEN] }, async (request) => {
  const profile = await requireProfile(request);
  const child = request.data && request.data.child;
  if (!child) throw new HttpsError("invalid-argument", "ไม่พบข้อมูลเด็ก");
  if (isVhv(profile) && profile.assignedVillage && child.village !== profile.assignedVillage) {
    throw new HttpsError("permission-denied", "คุณสามารถบันทึกข้อมูลได้เฉพาะในหมู่บ้านที่รับผิดชอบ");
  }

  const id = child.id || `CHILD_${Date.now()}`;
  const { scores, totalScore, status } = scoreChild(child);
  const ref = db.collection("children").doc(id);
  const existing = await ref.get();
  const isEdit = existing.exists;

  const docData = {
    id, name: child.name || "", age: child.age || "", house: child.house || "", moo: child.moo || "",
    village: child.village || "", tambon: child.tambon || "คลองหาด", amphoe: child.amphoe || "คลองหาด", province: child.province || "สระแก้ว",
    lat: child.lat ?? null, lng: child.lng ?? null, hct: child.hct ?? null, weight: child.weight ?? null, height: child.height ?? null,
    nutrition: child.nutrition || "", iron: child.iron || "", food: child.food || "", social: child.social || "",
    guardian: child.guardian || "", notes: child.notes || "",
    scores, totalScore, status, active: true,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!isEdit) docData.createdAt = FieldValue.serverTimestamp();
  await ref.set(docData, { merge: true });

  const actor = profile.email || profile.name;
  await logActivity(
    isEdit ? "แก้ไขข้อมูลเด็ก" : "เพิ่มข้อมูลเด็ก",
    `${isEdit ? "แก้ไขประวัติเด็ก" : "เพิ่มเด็กใหม่เข้าระบบ"}: ${docData.name} ID: ${id}`,
    actor
  );

  if (status === "เสี่ยงสูง") {
    await sendLineNotifyAlert(LINE_TOKEN.value(), docData.name, docData.village, docData.hct, totalScore);
  }
  return { success: true, id };
});

exports.deleteChild = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const id = request.data && request.data.id;
  if (!id) throw new HttpsError("invalid-argument", "ไม่พบ ID เด็ก");

  const ref = db.collection("children").doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { success: false };

  await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp() });
  await logActivity("ลบข้อมูลเด็ก", `ทำการลบ (Soft Delete) เด็ก ID: ${id} ชื่อ: ${snap.data().name}`, profile.email || profile.name);
  return { success: true };
});

exports.saveChildrenBatch = onCall({ secrets: [LINE_TOKEN] }, async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const list = (request.data && request.data.children) || [];

  const existingSnap = await db.collection("children").get();
  const idMap = {};
  const nameMap = {};
  existingSnap.forEach((doc) => {
    idMap[doc.id] = doc;
    const name = String(doc.data().name || "").trim();
    if (name) nameMap[name] = doc;
  });

  const fieldsToOverride = ["name", "age", "house", "moo", "village", "tambon", "amphoe", "province", "lat", "lng", "hct", "weight", "height", "nutrition", "iron", "food", "social", "guardian", "notes"];

  let addedCount = 0;
  let updatedCount = 0;
  let batch = db.batch();
  let opsInBatch = 0;
  const commits = [];

  for (const raw of list) {
    let id = raw.id;
    let existingDoc = null;
    if (!id && raw.name) {
      const match = nameMap[String(raw.name).trim()];
      if (match) { id = match.id; existingDoc = match; }
    } else if (id) {
      existingDoc = idMap[String(id)] || null;
    }

    const merged = existingDoc ? { ...existingDoc.data() } : {};
    fieldsToOverride.forEach((f) => {
      if (raw[f] !== undefined && raw[f] !== null && raw[f] !== "") merged[f] = raw[f];
    });
    if (!id) id = `CHILD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const { scores, totalScore, status } = scoreChild(merged);
    const docData = {
      id, name: merged.name || "", age: merged.age || "", house: merged.house || "", moo: merged.moo || "",
      village: merged.village || "", tambon: merged.tambon || "คลองหาด", amphoe: merged.amphoe || "คลองหาด", province: merged.province || "สระแก้ว",
      lat: merged.lat ?? null, lng: merged.lng ?? null, hct: merged.hct ?? null, weight: merged.weight ?? null, height: merged.height ?? null,
      nutrition: merged.nutrition || "", iron: merged.iron || "", food: merged.food || "", social: merged.social || "",
      guardian: merged.guardian || "", notes: merged.notes || "",
      scores, totalScore, status, active: true,
      updatedAt: FieldValue.serverTimestamp()
    };

    const ref = db.collection("children").doc(id);
    if (existingDoc) { updatedCount++; } else { docData.createdAt = FieldValue.serverTimestamp(); addedCount++; }
    batch.set(ref, docData, { merge: true });
    opsInBatch++;
    if (opsInBatch >= 450) { commits.push(batch.commit()); batch = db.batch(); opsInBatch = 0; }
  }
  if (opsInBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);

  await logActivity("นำเข้าข้อมูลเด็ก (Batch)", `นำเข้าเด็กปฐมวัยจำนวน ${list.length} คน (เพิ่มใหม่ ${addedCount}, อัปเดต ${updatedCount})`, profile.email || profile.name);
  return { success: true, added: addedCount, updated: updatedCount };
});

// ── MEDICINE LOG ───────────────────────────────────────────────────────────
exports.saveMedicineLog = onCall(async (request) => {
  const profile = await requireProfile(request);
  const logData = request.data || {};
  const logId = `MED_${Date.now()}`;

  await db.collection("medicineLog").doc(logId).set({
    logId, childId: logData.childId, date: logData.date, time: logData.time,
    taken: logData.taken, vhvId: logData.vhvId || profile.id, notes: logData.notes || "",
    createdAt: FieldValue.serverTimestamp()
  });

  if (logData.taken === "กินยาแล้ว" && logData.childId) {
    const parsed = new Date(`${logData.date}T${logData.time || "00:00"}`);
    if (!isNaN(parsed.getTime())) {
      await db.collection("children").doc(String(logData.childId))
        .update({ lastDate: admin.firestore.Timestamp.fromDate(parsed) })
        .catch(() => {});
    }
  }

  await logActivity("บันทึกเวลากินยา", `บันทึกการกินยาสำหรับเด็ก ID: ${logData.childId} วันที่: ${logData.date} สถานะ: ${logData.taken}`, profile.email || profile.name);
  return { success: true, logId };
});

// ── USER MANAGEMENT ─────────────────────────────────────────────────────────
exports.getUsersList = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const snap = await db.collection("users").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});

exports.saveUserRecord = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const u = request.data || {};
  const ref = u.id ? db.collection("users").doc(String(u.id)) : db.collection("users").doc();
  const payload = {
    name: u.name || "", role: u.role || "", email: u.email || "", lineUserId: u.lineUserId || "",
    phone: u.phone || "", assignedVillage: u.assignedVillage || "", status: u.status || "Active",
    updatedAt: FieldValue.serverTimestamp()
  };
  const existing = await ref.get();
  if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
  await ref.set(payload, { merge: true });

  await logActivity(existing.exists ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน", `${existing.exists ? "อัปเดตข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}: ${payload.name}`, profile.email || profile.name);
  return { success: true, id: ref.id };
});

// ── SYSTEM SETTINGS ──────────────────────────────────────────────────────
exports.getPublicSettings = onCall(async () => {
  const snap = await db.collection("settings").doc("public").get();
  const d = snap.exists ? snap.data() : {};
  return { liffId: d.liffId || "", lineClientId: d.lineClientId || "", lineRedirectUri: d.lineRedirectUri || "" };
});

exports.getSystemSettings = onCall({ secrets: [LINE_TOKEN, LINE_CLIENT_SECRET] }, async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const snap = await db.collection("settings").doc("public").get();
  const d = snap.exists ? snap.data() : {};
  return {
    liffId: d.liffId || "", lineClientId: d.lineClientId || "", lineRedirectUri: d.lineRedirectUri || "",
    hasLineToken: !!LINE_TOKEN.value(), hasLineClientSecret: !!LINE_CLIENT_SECRET.value()
  };
});

exports.saveSystemSettings = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const s = request.data || {};
  const update = {};
  ["liffId", "lineClientId", "lineRedirectUri"].forEach((k) => { if (s[k] !== undefined) update[k] = s[k]; });
  if (Object.keys(update).length) {
    await db.collection("settings").doc("public").set(update, { merge: true });
  }
  const warnings = [];
  if (s.lineToken !== undefined || s.lineClientSecret !== undefined) {
    warnings.push("lineToken และ lineClientSecret ตั้งค่าผ่าน CLI เท่านั้น: firebase functions:secrets:set LINE_TOKEN (และ LINE_CLIENT_SECRET) เพื่อความปลอดภัย ไม่รองรับการบันทึกผ่านหน้าเว็บ");
  }
  await logActivity("แก้ไขการตั้งค่าระบบ", "อัปเดตการตั้งค่าระบบ", profile.email || profile.name);
  return { success: true, warnings };
});

exports.testLineNotify = onCall({ secrets: [LINE_TOKEN] }, async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const token = LINE_TOKEN.value();
  if (!token) return { success: false, error: "ยังไม่ได้ตั้งค่า LINE Token (firebase functions:secrets:set LINE_TOKEN)" };

  const message = `\n🔔 [Iron Zero Risk]\nระบบทดสอบการแจ้งเตือนสำเร็จแล้ว!\nเวลา: ${formatDateTimeTH(new Date())}`;
  try {
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message })
    });
    if (res.status === 200) return { success: true };
    return { success: false, error: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
