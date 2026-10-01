const axios = require('axios');
const { withTransaction } = require('./db');

// MOPH ID login: Health ID token -> Provider ID token -> Provider ID profile.
async function fetchProviderProfile(code) {
  const isPrd = process.env.MOPH_ENV === 'prd';
  const healthIdBaseUrl = isPrd ? 'https://moph.id.th' : 'https://uat-moph.id.th';
  const providerIdBaseUrl = isPrd ? 'https://provider.id.th' : 'https://uat-provider.id.th';
  const redirectUri = process.env.HEALTHID_REDIRECT_URI || `${process.env.PUBLIC_BASE_URL}/auth/healthid/callback`;

  // 1. Health ID: แลก authorization code เป็น Health ID access token
  //    response: { status, data: { access_token, ... }, message }
  const healthTokenRes = await axios.post(`${healthIdBaseUrl}/api/v1/token`, new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: process.env.HEALTHID_CLIENT_ID,
    client_secret: process.env.HEALTHID_CLIENT_SECRET
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const healthAccessToken = healthTokenRes.data?.data?.access_token;
  if (!healthAccessToken) {
    throw new Error(`Health ID token missing in response (keys: ${Object.keys(healthTokenRes.data || {}).join(',')})`);
  }

  // 2. Provider ID: แลก Health ID token เป็น Provider ID token
  const providerTokenRes = await axios.post(`${providerIdBaseUrl}/api/v1/services/token`, {
    client_id: process.env.PROVIDERID_CLIENT_ID,
    secret_key: process.env.PROVIDERID_SECRET_KEY,
    token_by: 'Health ID',
    token: healthAccessToken
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  const providerAccessToken = providerTokenRes.data?.data?.access_token;
  if (!providerAccessToken) {
    throw new Error(`Provider ID token missing in response (keys: ${Object.keys(providerTokenRes.data || {}).join(',')})`);
  }

  // 3. Provider ID: ดึงโปรไฟล์เจ้าหน้าที่ (ชื่อจริง ตำแหน่ง หน่วยบริการ)
  const profileRes = await axios.get(`${providerIdBaseUrl}/api/v1/services/profile`, {
    params: { position_type: 1 },
    headers: {
      Authorization: `Bearer ${providerAccessToken}`,
      'client-id': process.env.PROVIDERID_CLIENT_ID,
      'secret-key': process.env.PROVIDERID_SECRET_KEY
    }
  });
  const p = profileRes.data?.data;
  if (!p) {
    throw new Error(`Provider ID profile missing in response (keys: ${Object.keys(profileRes.data || {}).join(',')})`);
  }

  // organization เป็น array (เจ้าหน้าที่ 1 คนอาจสังกัดหลายหน่วยบริการ) — ใช้รายการแรก
  const org = Array.isArray(p.organization) ? p.organization[0] : p.organization;
  const prefix = p.special_title_th || p.title_th || '';
  const name = p.name_th || `${prefix}${p.firstname_th || ''} ${p.lastname_th || ''}`.trim();
  if (!p.provider_id || !name) {
    throw new Error(`Provider ID profile incomplete (keys: ${Object.keys(p).join(',')})`);
  }
  return {
    provider_id: String(p.provider_id),
    name,
    position: org?.position || null,
    hospital: org?.hname_th || null,
    hcode: org?.hcode || null
  };
}

// Upserts the user from their Provider ID profile. The very first person to ever log
// in (empty users table) becomes admin; everyone else starts as Pending until an
// admin approves them in จัดการผู้ใช้งาน.
async function upsertUser(profile) {
  return withTransaction(async (client) => {
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const { rows: anyUser } = await client.query('SELECT 1 FROM users LIMIT 1');
    const bootstrap = anyUser.length === 0;
    const { rows } = await client.query(
      `INSERT INTO users (provider_id, name, position, hospital, hcode, role, status, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (provider_id) DO UPDATE SET
         name = EXCLUDED.name, position = EXCLUDED.position, hospital = EXCLUDED.hospital,
         hcode = EXCLUDED.hcode, last_login_at = now(), updated_at = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [profile.provider_id, profile.name, profile.position, profile.hospital, profile.hcode,
        bootstrap ? 'admin' : 'staff', bootstrap ? 'Active' : 'Pending']
    );
    return { user: rows[0], bootstrap };
  });
}

module.exports = { fetchProviderProfile, upsertUser };
