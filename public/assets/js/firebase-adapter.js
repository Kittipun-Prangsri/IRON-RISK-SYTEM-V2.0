// Firebase adapter: replaces GAS's `google.script.run` bridge with two globals
// that app.js (an unmodified classic script) consumes:
//   - window.backend : a google.script.run-shaped shim (.withSuccessHandler()
//     .withFailureHandler().<cloudFunctionName>(args)) backed by httpsCallable,
//     so most of app.js's existing call sites needed only a token rename.
//   - window.fb       : the genuinely new auth surface (Google/email/LINE/Provider ID/OTP
//     sign-in, session-ready check) that app.js's auth-specific functions call.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  signInWithCustomToken, signOut, onAuthStateChanged, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const functions = getFunctions(app);

// Served by `firebase emulators:start` (npm run dev) → talk to the local Auth
// and Functions emulators instead of production (ports from firebase.json).
const IS_LOCALHOST = ["localhost", "127.0.0.1"].indexOf(window.location.hostname) !== -1;
if (IS_LOCALHOST) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// ── window.backend: RPC shim ────────────────────────────────────────────
// Cloud Functions take a single `data` object; app.js's call sites still pass
// GAS-style positional args, so this maps each function's positional args to
// the payload shape functions/index.js expects.
const PAYLOAD_BUILDERS = {
  saveChild: (args) => ({ child: args[0] }),
  saveChildrenBatch: (args) => ({ children: args[0] }),
  deleteChild: (args) => ({ id: args[0] }),
  saveMedicineLog: (args) => args[0],
  saveUserRecord: (args) => args[0],
  saveSystemSettings: (args) => args[0],
  checkOtpEligibility: (args) => ({ phone: args[0] }),
  signInPhoneOtp: (args) => ({ phone: args[0] }),
  getData: () => undefined,
  getUsersList: () => undefined,
  getSystemSettings: () => undefined,
  getPublicSettings: () => undefined,
  testLineNotify: () => undefined,
  ensureUserProfile: () => undefined
};

function buildPayload(name, args) {
  const builder = PAYLOAD_BUILDERS[name];
  return builder ? builder(args) : args[0];
}

function makeRunner(successHandler, failureHandler) {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === "withSuccessHandler") return (fn) => makeRunner(fn, failureHandler);
      if (prop === "withFailureHandler") return (fn) => makeRunner(successHandler, fn);
      if (typeof prop !== "string") return undefined;
      return (...args) => {
        const callable = httpsCallable(functions, prop);
        callable(buildPayload(prop, args))
          .then((result) => { if (successHandler) successHandler(result.data); })
          .catch((err) => {
            if (failureHandler) failureHandler(err);
            else console.error("[backend]", prop, err);
          });
      };
    }
  });
}

window.backend = makeRunner(null, null);

// ── window.fb: auth surface ──────────────────────────────────────────────
let resolveAuthReady;
const authReadyPromise = new Promise((resolve) => { resolveAuthReady = resolve; });
let authReadyFired = false;
onAuthStateChanged(auth, (user) => {
  if (!authReadyFired) { authReadyFired = true; resolveAuthReady(user); }
});

// Provider ID (MOPH) login goes through Health ID's OAuth page; the state
// prefix tells its callback apart from LINE's, and the stored value guards
// against a forged callback (CSRF).
const PROVIDER_ID_STATE_PREFIX = "providerid_";
// Default Redirect URI path registered with Health ID; the SPA is served here
// too (Hosting rewrites ** → index.html), and returns to "/" after handling.
const PROVIDER_ID_CALLBACK_PATH = "/auth/healthid/callback";
const PROVIDER_ID_HEALTH_URLS = { uat: "https://uat-moph.id.th", prd: "https://moph.id.th" };

function sessionGet(key) {
  try { return window.sessionStorage.getItem(key); } catch (err) { return null; }
}
function sessionSet(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch (err) { /* storage blocked */ }
}
function sessionRemove(key) {
  try { window.sessionStorage.removeItem(key); } catch (err) { /* storage blocked */ }
}

// Local-only: without a Health ID client_id, skip the MOPH pages and "return"
// straight to our own callback with the code the Functions emulator mocks.
function mockProviderIdCallbackUrl() {
  const state = PROVIDER_ID_STATE_PREFIX + "mock_" + Date.now();
  sessionSet("providerIdState", state);
  sessionSet("providerIdRedirectUri", window.location.origin + PROVIDER_ID_CALLBACK_PATH);
  return PROVIDER_ID_CALLBACK_PATH + "?code=mock-providerid&state=" + encodeURIComponent(state);
}

function callEnsureProfile() {
  return httpsCallable(functions, "ensureUserProfile")().then((res) => res.data);
}

window.fb = {
  onAuthReady() { return authReadyPromise; },

  signInGoogle() {
    return signInWithPopup(auth, new GoogleAuthProvider()).then(() => callEnsureProfile());
  },

  signInStaffEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password).then(() => callEnsureProfile());
  },

  signInWithCustomToken(token) {
    return signInWithCustomToken(auth, token);
  },

  signOut() {
    return signOut(auth);
  },

  getLineLoginUrl() {
    return httpsCallable(functions, "getPublicSettings")().then((res) => {
      const settings = res.data || {};
      if (!settings.lineClientId) throw new Error("กรุณาตั้งค่า LINE Client ID ในระบบก่อนใช้งาน");
      const redirectUri = settings.lineRedirectUri || (window.location.origin + window.location.pathname);
      const state = "state_" + Date.now();
      return "https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=" +
        encodeURIComponent(settings.lineClientId) + "&redirect_uri=" + encodeURIComponent(redirectUri) +
        "&state=" + state + "&scope=profile%20openid";
    });
  },

  // Detects a LINE OAuth `?code=` on the current URL (we just came back from
  // LINE's authorize page), exchanges it server-side, signs in with the
  // resulting custom token, and strips the query string either way.
  handleLineRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return Promise.resolve({ handled: false });
    // A Provider ID callback also carries ?code= — leave it to handleProviderIdRedirect.
    if ((params.get("state") || "").indexOf(PROVIDER_ID_STATE_PREFIX) === 0) return Promise.resolve({ handled: false });

    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return httpsCallable(functions, "exchangeLineLogin")({ code })
      .then((res) => {
        const data = res.data || {};
        if (data.pending) return { handled: true, pending: true, user: data.user };
        return signInWithCustomToken(auth, data.customToken).then(() => ({ handled: true, success: true, user: data.user }));
      })
      .catch((err) => ({ handled: true, success: false, error: err && err.message ? err.message : String(err) }));
  },

  // {HealthID-URL}/oauth/redirect?client_id=&redirect_uri=&response_type=code
  // Uses window.PROVIDER_ID_CONFIG (firebase-config.js) directly when it has a
  // client_id, so the button works before anyone can log in to the Settings page;
  // otherwise falls back to the values saved on the Settings page.
  getProviderIdLoginUrl() {
    const config = window.PROVIDER_ID_CONFIG || {};
    const settingsPromise = config.healthIdClientId
      ? Promise.resolve({ healthIdClientId: config.healthIdClientId, providerIdEnv: config.env, providerIdRedirectUri: config.redirectUri })
      : httpsCallable(functions, "getPublicSettings")().then((res) => res.data || {});
    return settingsPromise.then((settings) => {
      if (!settings.healthIdClientId && IS_LOCALHOST) return mockProviderIdCallbackUrl();
      if (!settings.healthIdClientId) throw new Error("กรุณาตั้งค่า Health ID Client ID (public/firebase-config.js หรือหน้าตั้งค่าระบบ) ก่อนใช้งาน");
      const baseUrl = PROVIDER_ID_HEALTH_URLS[settings.providerIdEnv] || PROVIDER_ID_HEALTH_URLS.prd;
      const redirectUri = settings.providerIdRedirectUri || (window.location.origin + PROVIDER_ID_CALLBACK_PATH);
      const random = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Math.random()).slice(2);
      const state = PROVIDER_ID_STATE_PREFIX + random;
      sessionSet("providerIdState", state);
      sessionSet("providerIdRedirectUri", redirectUri);
      return baseUrl + "/oauth/redirect?client_id=" + encodeURIComponent(settings.healthIdClientId) +
        "&redirect_uri=" + encodeURIComponent(redirectUri) + "&response_type=code&state=" + encodeURIComponent(state);
    });
  },

  // Detects a Health ID callback (?code=&state=providerid_...), exchanges it
  // server-side for a Provider ID profile + custom token, and signs in.
  handleProviderIdRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state") || "";
    if (!code || state.indexOf(PROVIDER_ID_STATE_PREFIX) !== 0) return Promise.resolve({ handled: false });

    // Must match the redirect_uri sent on the authorize request — i.e. where we are now.
    const redirectUri = sessionGet("providerIdRedirectUri") || (window.location.origin + window.location.pathname);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, "/");
    }

    const expectedState = sessionGet("providerIdState");
    sessionRemove("providerIdState");
    sessionRemove("providerIdRedirectUri");
    if (!expectedState || expectedState !== state) {
      return Promise.resolve({ handled: true, success: false, error: "การเข้าสู่ระบบด้วย Provider ID ไม่ถูกต้อง (state ไม่ตรงกัน) กรุณาลองใหม่" });
    }

    return httpsCallable(functions, "exchangeProviderIdLogin")({ code, redirectUri })
      .then((res) => {
        const data = res.data || {};
        if (data.pending) return { handled: true, pending: true, user: data.user };
        return signInWithCustomToken(auth, data.customToken).then(() => ({ handled: true, success: true, user: data.user }));
      })
      .catch((err) => ({ handled: true, success: false, error: err && err.message ? err.message : String(err) }));
  }
};
