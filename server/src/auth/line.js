// LINE Login (OAuth 2.1 authorization code) — replaces GAS handleLineLoginCallback.
const { config } = require("../config");
const { LoginError } = require("./providerId");

async function fetchLineProfile(code) {
  const { clientId, clientSecret, redirectUri } = config.line;
  if (!clientId || !clientSecret) throw new LoginError("ยังไม่ได้ตั้งค่า LINE Client ID/Secret ในระบบ (.env)");

  const tokenResp = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret })
  });
  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenData.access_token) {
    throw new LoginError(`LINE Token error: ${tokenData.error_description || tokenData.error || tokenResp.status}`);
  }

  const profileResp = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileResp.json().catch(() => ({}));
  if (!profile.userId) throw new LoginError("ไม่สามารถดึงข้อมูล LINE Profile ได้");
  return profile;
}

module.exports = { fetchLineProfile };
