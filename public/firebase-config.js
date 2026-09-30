// Public Firebase Web config — these values are not secret (they identify the
// project to the client SDK; access is enforced by Firestore rules / Cloud
// Functions auth checks, not by hiding this object).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDfbPn6Vfc521sn8X41QPvt0kJbeP679VY",
  authDomain: "attendance-v1-adb30.firebaseapp.com",
  projectId: "attendance-v1-adb30",
  storageBucket: "attendance-v1-adb30.firebasestorage.app",
  messagingSenderId: "145096380096",
  appId: "1:145096380096:web:1cc6035196f3c60d8d2725",
  measurementId: "G-ZNGGFXVRVS"
};

// Provider ID (MOPH) login — the login button goes straight to
// {HealthID-URL}/oauth/redirect?client_id=...&redirect_uri=...&response_type=code
// using these values (client_id is public; secrets stay in Cloud Functions).
//   env:              "prd" → https://moph.id.th   |  "uat" → https://uat-moph.id.th
//   healthIdClientId: client_id ที่ได้จากการลงทะเบียนกับ Health ID
//   redirectUri:      ต้องตรงกับที่ลงทะเบียนไว้ (เว้นว่าง = <โดเมนปัจจุบัน>/auth/healthid/callback)
window.PROVIDER_ID_CONFIG = {
  env: "prd",
  healthIdClientId: "01939ac3-9394-7b9b-b3a4-0d53f13d3f32",
  redirectUri: ""
};
