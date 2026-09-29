const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const ROLE_STAFF = ["เจ้าหน้าที่ รพ.", "admin"];
const ROLE_VHV = "อสม.";

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งาน");
  }
  return request.auth;
}

async function getUserProfile(uid) {
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// Resolves the calling user's Firestore profile and enforces Active/Pending/Inactive status.
async function requireProfile(request) {
  const auth = requireAuth(request);
  const profile = await getUserProfile(auth.uid);
  if (!profile) {
    throw new HttpsError("permission-denied", "ไม่พบโปรไฟล์ผู้ใช้งานในระบบ");
  }
  if (profile.status === "Pending") {
    throw new HttpsError("permission-denied", "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ");
  }
  if (profile.status === "Inactive" || profile.status === "Disabled") {
    throw new HttpsError("permission-denied", "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  return profile;
}

function requireStaff(profile) {
  if (ROLE_STAFF.indexOf(profile.role) === -1) {
    throw new HttpsError("permission-denied", "เฉพาะเจ้าหน้าที่เท่านั้นที่ใช้งานส่วนนี้ได้");
  }
}

function isVhv(profile) {
  return profile.role === ROLE_VHV;
}

module.exports = { requireAuth, getUserProfile, requireProfile, requireStaff, isVhv, ROLE_STAFF, ROLE_VHV };
