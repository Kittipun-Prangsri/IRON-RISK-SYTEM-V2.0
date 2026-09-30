const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
// Modular import: the Functions emulator proxies `admin.firestore`, which drops
// the namespace's FieldValue/Timestamp statics (undefined there).
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

admin.initializeApp();
const db = admin.firestore();

const { scoreChild } = require("./lib/scoring");
const { requireAuth, requireProfile, requireStaff, isVhv } = require("./lib/auth");

function getSecret(name) {
  return process.env[name] || "";
}

// Health ID (OAuth) + Provider ID base URLs per environment — from
// "คู่มือการเชื่อมต่อระบบ Provider ID ด้วย OAuth ของ Health ID" (1 ก.ค. 2567).
const MOPH_ENDPOINTS = {
  uat: { healthId: "https://uat-moph.id.th", provider: "https://uat-provider.id.th" },
  prd: { healthId: "https://moph.id.th", provider: "https://provider.id.th" }
};

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
function cleanMophName(nameStr) {
  if (!nameStr) return "";
  let s = String(nameStr).trim();
  s = s.replace(/^(อื่นๆ|ไม่ระบุ)\s*/gi, "").trim();
  return s;
}

async function linkOrCreateProfile(uid, matchField, matchValue, defaults) {
  const directRef = db.collection("users").doc(uid);
  const directSnap = await directRef.get();

  const targetStatus = defaults.status || "Pending";
  const targetRole = defaults.role || "รอการอนุมัติ";
  const cleanName = cleanMophName(defaults.name) || "ผู้ใช้ใหม่";
  const avatarUrl = defaults.avatarUrl || "assets/images/moph-avatar.png";

  if (directSnap.exists) {
    const data = directSnap.data();
    const existingCleanName = cleanMophName(data.name) || cleanName;
    const updated = {
      ...data,
      name: existingCleanName,
      status: (targetStatus === "Active" && (data.status === "Pending" || !data.status)) ? "Active" : (data.status || targetStatus),
      role: (data.role && data.role !== "รอการอนุมัติ") ? data.role : targetRole,
      avatarUrl: data.avatarUrl || avatarUrl,
      updatedAt: FieldValue.serverTimestamp()
    };
    await directRef.set(updated, { merge: true });
    return { id: uid, ...updated };
  }

  let matchSnap = null;
  if (matchField && matchValue) {
    const q = await db.collection("users").where(matchField, "==", matchValue).limit(1).get();
    if (!q.empty) matchSnap = q.docs[0];
  }

  if (matchSnap) {
    const data = matchSnap.data();
    const existingCleanName = cleanMophName(data.name) || cleanName;
    const newStatus = targetStatus === "Active" ? "Active" : (data.status || "Pending");
    const newRole = (data.role && data.role !== "รอการอนุมัติ") ? data.role : targetRole;
    const merged = {
      ...data,
      name: existingCleanName,
      status: newStatus,
      role: newRole,
      avatarUrl: data.avatarUrl || avatarUrl,
      authUid: uid,
      linkedAt: FieldValue.serverTimestamp()
    };
    await directRef.set(merged, { merge: true });
    if (matchSnap.id !== uid) await matchSnap.ref.delete();
    return { id: uid, ...merged };
  }

  const created = {
    name: cleanName,
    role: targetRole,
    email: defaults.email || "",
    lineUserId: defaults.lineUserId || "",
    phone: defaults.phone || "",
    providerId: defaults.providerId || "",
    cid: defaults.cid || "",
    avatarUrl: avatarUrl,
    assignedVillage: "",
    status: targetStatus,
    authUid: uid,
    createdAt: FieldValue.serverTimestamp()
  };
  await directRef.set(created);
  await logActivity("ลงทะเบียน", `Auto-register ผู้ใช้ใหม่ (${created.status}): ${created.name}`, defaults.email || defaults.lineUserId || defaults.providerId || defaults.cid || uid);
  return { id: uid, ...created };
}

async function findUserByField(field, value) {
  const q = await db.collection("users").where(field, "==", value).limit(1).get();
  if (q.empty) return null;
  return { id: q.docs[0].id, ref: q.docs[0].ref, data: q.docs[0].data() };
}

// ── AUTH: PHONE/OTP (VHV) ────────────────────────────────────────────────
// The SMS code itself is generated/verified client-side (no SMS provider
// wired up) — these two calls only check phone-number eligibility and, once
// the client accepts the code, establish a real Firebase Auth session for a
// pre-registered phone number (staff must have added the user via saveUserRecord).
exports.checkOtpEligibility = onCall(async (request) => {
  const phone = request.data && request.data.phone;
  if (!phone) throw new HttpsError("invalid-argument", "ไม่พบเบอร์โทรศัพท์");
  const match = await findUserByField("phone", phone);
  if (!match) return { success: false, error: `ไม่พบบัญชีผู้ใช้งานในระบบ (เบอร์โทร: ${phone})` };
  if (match.data.status === "Pending") return { success: false, pending: true, user: { id: match.id, ...match.data } };
  if (match.data.status === "Inactive" || match.data.status === "Disabled") {
    return { success: false, error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }
  return { success: true };
});

exports.signInPhoneOtp = onCall(async (request) => {
  const phone = request.data && request.data.phone;
  if (!phone) throw new HttpsError("invalid-argument", "ไม่พบเบอร์โทรศัพท์");
  const match = await findUserByField("phone", phone);
  if (!match) throw new HttpsError("not-found", `ไม่พบบัญชีผู้ใช้งานในระบบ (เบอร์โทร: ${phone})`);
  if (match.data.status === "Pending") return { success: false, pending: true, user: { id: match.id, ...match.data } };
  if (match.data.status === "Inactive" || match.data.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const uid = match.data.authUid || `phone_${String(phone).replace(/[^0-9]/g, "")}`;
  let profile = match.data;
  if (match.id !== uid) {
    profile = { ...match.data, authUid: uid, linkedAt: FieldValue.serverTimestamp() };
    await db.collection("users").doc(uid).set(profile, { merge: true });
    await match.ref.delete();
  } else if (!match.data.authUid) {
    await match.ref.set({ authUid: uid }, { merge: true });
  }

  const customToken = await admin.auth().createCustomToken(uid);
  await logActivity("เข้าสู่ระบบ", "เข้าสู่ระบบผ่าน OTP", phone);
  return { success: true, customToken, user: { id: uid, ...profile } };
});

// ── AUTH: LINE LOGIN CODE EXCHANGE (public — this call establishes auth) ────
exports.exchangeLineLogin = onCall(async (request) => {
  const code = request.data && request.data.code;
  if (!code) throw new HttpsError("invalid-argument", "ไม่พบ authorization code");

  const settingsSnap = await db.collection("settings").doc("public").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const clientId = settings.lineClientId || "";
  const redirectUri = settings.lineRedirectUri || "";
  const clientSecret = getSecret("LINE_CLIENT_SECRET");

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

// ── AUTH: PROVIDER ID (MOPH) CODE EXCHANGE (public — this call establishes auth) ─
// Two systems: Health ID issues the OAuth code/token, then that token is
// exchanged at Provider ID (separate client_id/secret_key) for a provider
// token, which is what unlocks the provider's profile. A Health ID user with
// no Provider ID gets HTTP 400 at the second step.
async function readJson(resp) {
  const text = await resp.text();
  try { return JSON.parse(text); } catch (err) { return { message: text.slice(0, 200) }; }
}

// Health ID code → Health ID token → Provider ID token → Provider ID profile (`data`).
async function fetchProviderIdProfile(code, redirectUri) {
  const settingsSnap = await db.collection("settings").doc("public").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  // Settings page values win; functions/.env (HEALTHID_CLIENT_ID, PROVIDERID_CLIENT_ID,
  // PROVIDERID_ENV) is the fallback for before anyone can log in to set them.
  const endpoints = MOPH_ENDPOINTS[settings.providerIdEnv || process.env.PROVIDERID_ENV] || MOPH_ENDPOINTS.prd;
  const healthIdClientId = settings.healthIdClientId || process.env.HEALTHID_CLIENT_ID || "";
  const providerClientId = settings.providerIdClientId || process.env.PROVIDERID_CLIENT_ID || "";
  // Health ID requires the exact redirect_uri used on the authorize request.
  redirectUri = redirectUri || settings.providerIdRedirectUri || "";
  const healthIdSecret = getSecret("HEALTHID_CLIENT_SECRET");
  const providerSecret = getSecret("PROVIDERID_SECRET_KEY");

  if (!healthIdClientId || !healthIdSecret || !providerClientId || !providerSecret) {
    throw new HttpsError("failed-precondition", "ยังไม่ได้ตั้งค่า Health ID / Provider ID Client ID หรือ Secret ในระบบ");
  }

  // 1. Health ID: code → access_token
  const healthResp = await fetch(`${endpoints.healthId}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: healthIdClientId,
      client_secret: healthIdSecret
    })
  });
  const healthData = await readJson(healthResp);
  const healthToken = healthData.data && healthData.data.access_token;
  if (!healthResp.ok || !healthToken) {
    console.error("Health ID token failed", healthResp.status, healthData.message);
    throw new HttpsError("unauthenticated", `Health ID Token error: ${healthData.message || healthResp.status}`);
  }

  // 2. Provider ID: Health ID token → provider access_token
  const providerTokenResp = await fetch(`${endpoints.provider}/api/v1/services/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: providerClientId, secret_key: providerSecret, token_by: "Health ID", token: healthToken })
  });
  const providerTokenData = await readJson(providerTokenResp);
  if (providerTokenResp.status === 400) {
    throw new HttpsError("permission-denied", "บัญชี Health ID นี้ยังไม่มี Provider ID กรุณาสมัคร Provider ID ก่อนใช้งาน");
  }
  const providerToken = providerTokenData.data && providerTokenData.data.access_token;
  if (!providerTokenResp.ok || !providerToken) {
    console.error("Provider ID token failed", providerTokenResp.status, providerTokenData.message);
    throw new HttpsError("unauthenticated", `Provider ID Token error: ${providerTokenData.message || providerTokenResp.status}`);
  }

  // 3. Provider ID: profile (name + organization[] affiliations)
  const profileResp = await fetch(`${endpoints.provider}/api/v1/services/profile`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerToken}`,
      "client-id": providerClientId,
      "secret-key": providerSecret
    }
  });
  const profileData = await readJson(profileResp);
  const provider = profileData.data;
  if (!profileResp.ok || !provider || !provider.provider_id) {
    console.error("Provider ID profile failed", profileResp.status, profileData.message);
    if (profileResp.status === 404) {
      throw new HttpsError("permission-denied", "ไม่พบข้อมูล Provider ID ของบัญชีนี้");
    }
    throw new HttpsError("internal", `ไม่สามารถดึงข้อมูล Provider ID ได้: ${profileData.message || profileResp.status}`);
  }

  return provider;
}

// Emulator-only stand-in for the real Health ID/Provider ID round trip, so the
// post-login flow can be exercised on localhost before MOPH credentials exist.
// Shape copied from the guide's example profile response.
const MOCK_PROVIDER_CODE = "mock-providerid";
const MOCK_PROVIDER_PROFILE = {
  provider_id: "0111111111X21",
  special_title_th: "นายแพทย์",
  name_th: "หมอพร้อม สงบสุข",
  name_eng: "Mophrom Eng",
  organization: [{ position: "แพทย์", hcode: "10999", hname_th: "โรงพยาบาลทดสอบ (Mock)" }]
};

// ── AUTH: DIRECT HEALTH ID CODE EXCHANGE ────────────────────────────────
const MOCK_HEALTHID_CODE = "mock-healthid";
const MOCK_HEALTHID_PROFILE = {
  cid: "1100100000001",
  title_th: "นาย",
  firstname_th: "ทดสอบ",
  lastname_th: "ระบบสุขภาพ",
  name_th: "นาย ทดสอบ ระบบสุขภาพ",
  email: "healthid_test@moph.go.th",
  mobile: "0812345678",
  hcode: "10999"
};

async function fetchHealthIdDirectProfile(code, redirectUri) {
  const settingsSnap = await db.collection("settings").doc("public").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const endpoints = MOPH_ENDPOINTS[settings.providerIdEnv || process.env.PROVIDERID_ENV] || MOPH_ENDPOINTS.prd;
  const healthIdClientId = settings.healthIdClientId || process.env.HEALTHID_CLIENT_ID || "";
  redirectUri = redirectUri || settings.providerIdRedirectUri || "";
  const healthIdSecret = getSecret("HEALTHID_CLIENT_SECRET");

  if (!healthIdClientId || !healthIdSecret) {
    throw new HttpsError("failed-precondition", "ยังไม่ได้ตั้งค่า Health ID Client ID หรือ Client Secret ในระบบ");
  }

  // 1. Health ID: code → access_token
  const healthResp = await fetch(`${endpoints.healthId}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: healthIdClientId,
      client_secret: healthIdSecret
    })
  });
  const healthData = await readJson(healthResp);
  const healthToken = (healthData.data && healthData.data.access_token) || healthData.access_token;
  if (!healthResp.ok || !healthToken) {
    console.error("Health ID token failed", healthResp.status, healthData.message || healthData.error_description || healthData.error);
    throw new HttpsError("unauthenticated", `Health ID Token error: ${healthData.message || healthData.error_description || healthData.error || healthResp.status}`);
  }

  // 2. Health ID Profile API (Try /profile -> /userinfo -> /me)
  let profileResp = await fetch(`${endpoints.healthId}/api/v1/profile`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${healthToken}` }
  });
  if (!profileResp.ok) {
    profileResp = await fetch(`${endpoints.healthId}/api/v1/userinfo`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${healthToken}` }
    });
  }
  if (!profileResp.ok) {
    profileResp = await fetch(`${endpoints.healthId}/api/v1/me`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${healthToken}` }
    });
  }

  const profileData = await readJson(profileResp);
  const healthUser = profileData.data || profileData.user || profileData;
  const cid = healthUser.cid || healthUser.pid || healthUser.health_id || healthUser.id || healthUser.national_id || healthUser.sub || "";

  if (!profileResp.ok || !cid) {
    console.error("Health ID profile failed", profileResp.status, profileData.message || profileData.error);
    throw new HttpsError("internal", `ไม่สามารถดึงข้อมูล Health ID Profile ได้: ${profileData.message || profileData.error || profileResp.status}`);
  }

  return { healthUser, accessToken: healthToken };
}

exports.exchangeHealthIdLogin = onCall(async (request) => {
  const code = request.data && request.data.code;
  if (!code) throw new HttpsError("invalid-argument", "ไม่พบ authorization code");

  const isMock = code === MOCK_HEALTHID_CODE && process.env.FUNCTIONS_EMULATOR === "true";
  const { healthUser, accessToken } = isMock
    ? { healthUser: MOCK_HEALTHID_PROFILE, accessToken: "mock-healthid-token" }
    : await fetchHealthIdDirectProfile(code, request.data.redirectUri);

  const cid = healthUser.cid || healthUser.pid || healthUser.health_id || healthUser.id || healthUser.national_id || healthUser.sub || "";
  let title = healthUser.title_th || healthUser.title || healthUser.prefix || "";
  if (title === "อื่นๆ" || title === "ไม่ระบุ") title = "";
  const firstName = healthUser.firstname_th || healthUser.first_name_th || healthUser.first_name || healthUser.firstname || "";
  const lastName = healthUser.lastname_th || healthUser.last_name_th || healthUser.last_name || healthUser.lastname || "";
  let fullName = healthUser.name_th || healthUser.name || [title, firstName, lastName].filter(Boolean).join(" ").trim();
  fullName = cleanMophName(fullName);

  const uid = `healthid_${cid}`;
  const avatarUrl = healthUser.picture || healthUser.image_url || healthUser.avatar || "assets/images/moph-avatar.png";

  const userProfile = await linkOrCreateProfile(uid, "cid", cid, {
    name: fullName || "ผู้ใช้งาน Health ID",
    email: healthUser.email || "",
    phone: healthUser.mobile || healthUser.telephone || healthUser.phone || "",
    cid: cid,
    role: "เจ้าหน้าที่",
    avatarUrl: avatarUrl,
    status: "Active"
  });

  const enriched = {
    ...userProfile,
    displayName: fullName || userProfile.name,
    cid: cid,
    hospitalCode: healthUser.hcode || healthUser.hname || "",
    healthIdToken: accessToken
  };

  if (userProfile.status === "Pending") {
    return { pending: true, user: enriched };
  }
  if (userProfile.status === "Inactive" || userProfile.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const customToken = await admin.auth().createCustomToken(uid);
  await logActivity("เข้าสู่ระบบ", `เข้าสู่ระบบผ่าน Health ID (CID: ${cid})`, userProfile.email || cid);
  return { customToken, user: enriched };
});

exports.exchangeProviderIdLogin = onCall(async (request) => {
  const code = request.data && request.data.code;
  if (!code) throw new HttpsError("invalid-argument", "ไม่พบ authorization code");

  const isMock = code === MOCK_PROVIDER_CODE && process.env.FUNCTIONS_EMULATOR === "true";
  const provider = isMock
    ? MOCK_PROVIDER_PROFILE
    : await fetchProviderIdProfile(code, request.data.redirectUri);

  let title = provider.special_title_th || provider.title_th || "";
  if (title === "อื่นๆ" || title === "ไม่ระบุ") title = "";
  let rawName = provider.name_th || [provider.firstname_th, provider.lastname_th].filter(Boolean).join(" ");
  let fullName = [title, cleanMophName(rawName)].filter(Boolean).join(" ").trim() || provider.name_eng || "ผู้ใช้งาน Provider ID";
  fullName = cleanMophName(fullName);

  const orgs = Array.isArray(provider.organization) ? provider.organization : [];
  const org = orgs[0] || {};
  const avatarUrl = provider.picture || provider.image_url || provider.avatar || "assets/images/moph-avatar.png";

  const uid = `providerid_${provider.provider_id}`;
  const userProfile = await linkOrCreateProfile(uid, "providerId", provider.provider_id, {
    name: fullName,
    providerId: provider.provider_id,
    role: org.position || "เจ้าหน้าที่",
    avatarUrl: avatarUrl,
    status: "Active"
  });

  const enriched = {
    ...userProfile,
    displayName: fullName || userProfile.name,
    position: org.position || "",
    hospitalCode: org.hcode || "",
    hospitalName: org.hname_th || ""
  };

  if (userProfile.status === "Pending") {
    return { pending: true, user: enriched };
  }
  if (userProfile.status === "Inactive" || userProfile.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const customToken = await admin.auth().createCustomToken(uid);
  await logActivity("เข้าสู่ระบบ", `เข้าสู่ระบบผ่าน Provider ID (${org.hname_th || "-"})`, userProfile.email || provider.provider_id);
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
exports.saveChild = onCall(async (request) => {
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
    await sendLineNotifyAlert(getSecret("LINE_TOKEN"), docData.name, docData.village, docData.hct, totalScore);
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

exports.saveChildrenBatch = onCall(async (request) => {
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
        .update({ lastDate: Timestamp.fromDate(parsed) })
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
  return {
    liffId: d.liffId || process.env.LIFF_ID || "",
    lineClientId: d.lineClientId || process.env.LINE_CLIENT_ID || "",
    lineRedirectUri: d.lineRedirectUri || process.env.LINE_REDIRECT_URI || "",
    healthIdClientId: d.healthIdClientId || process.env.HEALTHID_CLIENT_ID || "",
    providerIdClientId: d.providerIdClientId || process.env.PROVIDERID_CLIENT_ID || "",
    providerIdRedirectUri: d.providerIdRedirectUri || process.env.PROVIDERID_REDIRECT_URI || "",
    providerIdEnv: d.providerIdEnv || process.env.PROVIDERID_ENV || "prd"
  };
});

exports.getSystemSettings = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const snap = await db.collection("settings").doc("public").get();
  const d = snap.exists ? snap.data() : {};
  return {
    liffId: d.liffId || process.env.LIFF_ID || "",
    lineClientId: d.lineClientId || process.env.LINE_CLIENT_ID || "",
    lineRedirectUri: d.lineRedirectUri || process.env.LINE_REDIRECT_URI || "",
    healthIdClientId: d.healthIdClientId || process.env.HEALTHID_CLIENT_ID || "",
    providerIdClientId: d.providerIdClientId || process.env.PROVIDERID_CLIENT_ID || "",
    providerIdRedirectUri: d.providerIdRedirectUri || process.env.PROVIDERID_REDIRECT_URI || "",
    providerIdEnv: d.providerIdEnv || process.env.PROVIDERID_ENV || "prd",
    hasLineToken: !!getSecret("LINE_TOKEN"),
    hasLineClientSecret: !!getSecret("LINE_CLIENT_SECRET"),
    hasHealthIdClientSecret: !!getSecret("HEALTHID_CLIENT_SECRET"),
    hasProviderIdSecretKey: !!getSecret("PROVIDERID_SECRET_KEY")
  };
});

exports.saveSystemSettings = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const s = request.data || {};
  const update = {};
  ["liffId", "lineClientId", "lineRedirectUri", "healthIdClientId", "providerIdClientId", "providerIdRedirectUri"]
    .forEach((k) => { if (s[k] !== undefined) update[k] = s[k]; });
  if (s.providerIdEnv !== undefined) update.providerIdEnv = s.providerIdEnv === "uat" ? "uat" : "prd";
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

exports.testLineNotify = onCall(async (request) => {
  const profile = await requireProfile(request);
  requireStaff(profile);
  const token = getSecret("LINE_TOKEN");
  if (!token) return { success: false, error: "ยังไม่ได้ตั้งค่า LINE Token ใน functions/.env หรือ .secret.local" };

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
