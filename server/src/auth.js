const { query } = require('./db');
const { COOKIE_NAME, readCookie, verifySessionToken } = require('./session');

// Loads the logged-in, Active user into req.user or answers 401.
async function requireUser(req, res, next) {
  const session = verifySessionToken(readCookie(req, COOKIE_NAME));
  if (!session) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    const [user] = await query('SELECT * FROM users WHERE id = $1', [session.uid]);
    if (!user || user.status !== 'Active') return res.status(401).json({ error: 'บัญชีนี้ไม่มีสิทธิ์ใช้งาน' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' });
    next();
  };
}

// อสม. only see children in their assigned village (หมู่ number within ต.คลองหาด;
// the routes add the ตำบล condition).
function villageScope(user) {
  return user.role === 'vhv' ? user.assigned_village_no ?? -1 : null;
}

module.exports = { requireUser, requireRole, villageScope };
