// All configuration comes from environment variables (server/.env).
// Secrets (MOPH, LINE, DB passwords, SESSION_SECRET) must never be committed.
const path = require("path");
require("dotenv").config({ path: process.env.ENV_FILE || path.join(__dirname, "..", ".env") });

const env = process.env;

function bool(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].indexOf(String(value).toLowerCase()) !== -1;
}

const publicBaseUrl = (env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, "");

const MOPH_ENDPOINTS = {
  uat: { healthId: "https://uat-moph.id.th", provider: "https://uat-provider.id.th" },
  prd: { healthId: "https://moph.id.th", provider: "https://provider.id.th" }
};

const config = {
  port: Number(env.PORT || 3000),                  // backend: API only (/api/*, /healthz)
  frontendPort: Number(env.FRONTEND_PORT || 0),   // frontend: web page + OAuth callbacks + /api (0 = same as PORT)
  publicBaseUrl,
  // Frontend templates (Index.html + partials) shared with the GAS version.
  srcDir: path.resolve(__dirname, "..", env.SRC_DIR || "../src"),
  sessionSecret: env.SESSION_SECRET || "",
  sessionHours: Number(env.SESSION_HOURS || 12),
  cookieSecure: bool(env.COOKIE_SECURE, publicBaseUrl.startsWith("https://")),
  // Local development only: allows the "dev quick login" panel / mock SSO buttons.
  devLogin: bool(env.DEV_LOGIN, false),

  db: {
    url: env.DATABASE_URL || "",
    host: env.DB_HOST || "127.0.0.1",
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || "iron_risk",
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME || "iron_risk"
  },

  // Read-only connection to the HOSxP database (optional).
  hosxp: {
    enabled: bool(env.HOSXP_ENABLED, false),
    host: env.HOSXP_DB_HOST || "",
    port: Number(env.HOSXP_DB_PORT || 3306),
    user: env.HOSXP_DB_USER || "",
    password: env.HOSXP_DB_PASSWORD || "",
    database: env.HOSXP_DB_NAME || "hos",
    // How opduser.passweb is stored: "md5" (MD5 hex, compared case-insensitively) or "plain".
    passwordHash: (env.HOSXP_PASSWORD_HASH || "md5").toLowerCase()
  },

  moph: {
    endpoints: MOPH_ENDPOINTS[env.MOPH_ENV] || MOPH_ENDPOINTS.prd,
    healthIdClientId: env.HEALTHID_CLIENT_ID || "",
    healthIdClientSecret: env.HEALTHID_CLIENT_SECRET || "",
    providerIdClientId: env.PROVIDERID_CLIENT_ID || "",
    providerIdSecretKey: env.PROVIDERID_SECRET_KEY || "",
    redirectUri: env.PROVIDERID_REDIRECT_URI || `${publicBaseUrl}/auth/healthid/callback`
  },

  line: {
    clientId: env.LINE_CLIENT_ID || "",
    clientSecret: env.LINE_CLIENT_SECRET || "",
    redirectUri: env.LINE_REDIRECT_URI || `${publicBaseUrl}/`,
    liffId: env.LIFF_ID || ""
  }
};

if (!/^[a-z_][a-z0-9_]*$/.test(config.db.schema)) {
  throw new Error(`DB_SCHEMA must be a plain lowercase identifier, got "${config.db.schema}"`);
}

function assertConfig() {
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters (see .env.example)");
  }
  if (!config.db.url && !config.db.host) {
    throw new Error("DATABASE_URL or DB_HOST must be set");
  }
}

module.exports = { config, assertConfig };
