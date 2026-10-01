require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test endpoint
app.get('/', (req, res) => {
  res.send('IRON RISK Server is running');
});

// HealthID Callback Endpoint
app.get('/auth/healthid/callback', async (req, res) => {
  
  const { code, state, error } = req.query;

  if (error) {
    console.error('HealthID Authorization Error:', error);
    return res.status(400).send(`Authorization Error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  const isPrd = process.env.MOPH_ENV === 'prd';
  const healthIdBaseUrl = isPrd ? 'https://moph.id.th' : 'https://uat-moph.id.th';
  const providerIdBaseUrl = isPrd ? 'https://provider.id.th' : 'https://uat-provider.id.th';
  const redirectUri = process.env.HEALTHID_REDIRECT_URI || `${process.env.PUBLIC_BASE_URL}/auth/healthid/callback`;

  try {
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
    const firstName = p.firstname_th || '';
    const lastName = p.lastname_th || '';
    const prefix = p.special_title_th || p.title_th || '';
    const name = p.name_th || `${prefix}${firstName} ${lastName}`.trim();
    if (!name) {
      throw new Error(`Provider ID profile has no Thai name (keys: ${Object.keys(p).join(',')})`);
    }

    // เก็บเฉพาะข้อมูลที่ UI ใช้ (ไม่เก็บเลขบัตร/hash_cid ลง cookie และกัน cookie เกิน 4KB)
    const session = {
      provider_id: p.provider_id || null,
      name,
      first_name: firstName,
      last_name: lastName,
      position: org?.position || '',
      hospital: org?.hname_th || '',
      hcode: org?.hcode || ''
    };
    console.log(`HealthID login OK: provider_id=${session.provider_id} hcode=${session.hcode}`);

    res.cookie('healthid_profile', JSON.stringify(session), {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: false, // Allow frontend JS to read for UI
      secure: isPrd,
      sameSite: 'lax',
      path: '/' // สำคัญมาก: ต้องให้ cookie อ่านได้จากทุกหน้า (รวมถึง /dashboard)
    });

    res.redirect(`${process.env.PUBLIC_BASE_URL}/dashboard`);

  } catch (err) {
    console.error('HealthID/ProviderID login failed:', err.config?.url || '', err.response?.status || '', err.response?.data || err.message);
    res.clearCookie('healthid_profile', { path: '/' });
    res.redirect(`${process.env.PUBLIC_BASE_URL}/?error=login_failed`);
  }
});

// Logout: ลบ cookie แล้วกลับหน้า login
app.get('/auth/logout', (req, res) => {
  res.clearCookie('healthid_profile', { path: '/' });
  res.redirect(`${process.env.PUBLIC_BASE_URL}/`);
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
