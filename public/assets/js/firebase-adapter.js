// Firebase adapter: replaces GAS's `google.script.run` bridge with two globals
// that app.js (an unmodified classic script) consumes:
//   - window.backend : a google.script.run-shaped shim (.withSuccessHandler()
//     .withFailureHandler().<cloudFunctionName>(args)) backed by httpsCallable,
//     so most of app.js's existing call sites needed only a token rename.
//   - window.fb       : the genuinely new auth surface (Google/email/LINE/OTP
//     sign-in, session-ready check) that app.js's auth-specific functions call.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  signInWithCustomToken, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const functions = getFunctions(app);

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
  }
};
