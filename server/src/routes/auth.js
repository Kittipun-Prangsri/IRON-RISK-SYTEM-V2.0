const express = require('express');
const { fetchProviderProfile, upsertUser } = require('../mophLogin');
const { setSessionCookie, clearSessionCookie } = require('../session');
const { logActivity } = require('../activity');

const router = express.Router();

router.get('/healthid/callback', async (req, res) => {
  const base = process.env.PUBLIC_BASE_URL;
  const { code, error } = req.query;
  if (error || !code) {
    console.error('HealthID Authorization Error:', error || 'missing code');
    return res.redirect(`${base}/?error=login_failed`);
  }

  try {
    const profile = await fetchProviderProfile(code);
    const { user, bootstrap } = await upsertUser(profile);
    console.log(`HealthID login: provider_id=${user.provider_id} hcode=${user.hcode} status=${user.status}${bootstrap ? ' (bootstrap admin)' : ''}`);

    if (user.status !== 'Active') {
      clearSessionCookie(res);
      if (user.inserted) await logActivity(user, 'ขอสิทธิ์เข้าใช้งาน', `${user.name} (${user.hospital || '-'}) รออนุมัติ`);
      return res.redirect(`${base}/?error=${user.status === 'Pending' ? 'pending' : 'suspended'}`);
    }

    setSessionCookie(res, user.id);
    await logActivity(user, 'เข้าสู่ระบบ', bootstrap ? 'เข้าสู่ระบบผ่าน MOPH ID (ตั้งเป็นผู้ดูแลระบบคนแรก)' : 'เข้าสู่ระบบผ่าน MOPH ID');
    res.redirect(`${base}/dashboard`);
  } catch (err) {
    console.error('HealthID/ProviderID login failed:', err.config?.url || '', err.response?.status || '', err.response?.data || err.message);
    clearSessionCookie(res);
    res.redirect(`${base}/?error=login_failed`);
  }
});

// Logout: ลบ cookie แล้วกลับหน้า login
router.get('/logout', (req, res) => {
  clearSessionCookie(res);
  res.clearCookie('healthid_profile', { path: '/' }); // cookie from the previous version
  res.redirect(`${process.env.PUBLIC_BASE_URL}/`);
});

module.exports = router;
