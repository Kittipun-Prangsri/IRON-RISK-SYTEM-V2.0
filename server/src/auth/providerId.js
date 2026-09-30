// MOPH Health ID OAuth → Provider ID, per "คู่มือการเชื่อมต่อระบบ Provider ID
// ด้วย OAuth ของ Health ID" (1 ก.ค. 2567). Two systems with separate
// credentials: Health ID issues the code/token, Provider ID exchanges that
// token for its own token, which unlocks the provider profile.
const { config } = require("../config");

class LoginError extends Error {}

async function readJson(resp) {
  const text = await resp.text();
  try { return JSON.parse(text); } catch (err) { return { message: text.slice(0, 200) }; }
}

function assertConfigured() {
  const m = config.moph;
  if (!m.healthIdClientId || !m.healthIdClientSecret || !m.providerIdClientId || !m.providerIdSecretKey) {
    throw new LoginError("ยังไม่ได้ตั้งค่า Health ID / Provider ID Client ID หรือ Secret ในระบบ (.env)");
  }
}

// {HealthID-URL}/oauth/redirect?client_id=&redirect_uri=&response_type=code&state=
function buildAuthUrl(state) {
  if (!config.moph.healthIdClientId) throw new LoginError("ยังไม่ได้ตั้งค่า HEALTHID_CLIENT_ID ใน .env");
  return `${config.moph.endpoints.healthId}/oauth/redirect` +
    `?client_id=${encodeURIComponent(config.moph.healthIdClientId)}` +
    `&redirect_uri=${encodeURIComponent(config.moph.redirectUri)}` +
    `&response_type=code&state=${encodeURIComponent(state)}`;
}

// code → Health ID token → Provider ID token → Provider ID profile (`data`).
async function fetchProviderProfile(code) {
  assertConfigured();
  const m = config.moph;

  const healthResp = await fetch(`${m.endpoints.healthId}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: m.redirectUri,
      client_id: m.healthIdClientId,
      client_secret: m.healthIdClientSecret
    })
  });
  const healthData = await readJson(healthResp);
  const healthToken = healthData.data && healthData.data.access_token;
  if (!healthResp.ok || !healthToken) {
    console.error("[providerId] Health ID token failed", healthResp.status, healthData.message);
    throw new LoginError(`Health ID Token error: ${healthData.message || healthResp.status}`);
  }

  const tokenResp = await fetch(`${m.endpoints.provider}/api/v1/services/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: m.providerIdClientId, secret_key: m.providerIdSecretKey, token_by: "Health ID", token: healthToken })
  });
  const tokenData = await readJson(tokenResp);
  if (tokenResp.status === 400) {
    throw new LoginError("บัญชี Health ID นี้ยังไม่มี Provider ID กรุณาสมัคร Provider ID ก่อนใช้งาน");
  }
  const providerToken = tokenData.data && tokenData.data.access_token;
  if (!tokenResp.ok || !providerToken) {
    console.error("[providerId] Provider ID token failed", tokenResp.status, tokenData.message);
    throw new LoginError(`Provider ID Token error: ${tokenData.message || tokenResp.status}`);
  }

  const profileResp = await fetch(`${m.endpoints.provider}/api/v1/services/profile`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerToken}`,
      "client-id": m.providerIdClientId,
      "secret-key": m.providerIdSecretKey
    }
  });
  const profileData = await readJson(profileResp);
  const provider = profileData.data;
  if (profileResp.status === 404) throw new LoginError("ไม่พบข้อมูล Provider ID ของบัญชีนี้");
  if (!profileResp.ok || !provider || !provider.provider_id) {
    console.error("[providerId] profile failed", profileResp.status, profileData.message);
    throw new LoginError(`ไม่สามารถดึงข้อมูล Provider ID ได้: ${profileData.message || profileResp.status}`);
  }
  return provider;
}

function displayName(provider) {
  const title = provider.special_title_th || provider.title_th || "";
  const name = provider.name_th || [provider.firstname_th, provider.lastname_th].filter(Boolean).join(" ");
  return [title, name].filter(Boolean).join(" ").trim() || provider.name_eng || "";
}

module.exports = { buildAuthUrl, fetchProviderProfile, displayName, LoginError };
