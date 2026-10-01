const express = require('express');
const { pool, query, withTransaction } = require('../db');
const { requireUser, requireRole, villageScope } = require('../auth');
const { logActivity } = require('../activity');
const { ValidationError, insertChild, updateChild, importChildren } = require('../children');

const router = express.Router();
router.use(requireUser);

const STAFF = ['admin', 'staff'];
const MAX_IMPORT_ROWS = 1000;

// Wraps async handlers so rejected promises reach the error middleware.
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function publicUser(u) {
  return {
    id: u.id, name: u.name, position: u.position, hospital: u.hospital, hcode: u.hcode,
    role: u.role, assigned_village_no: u.assigned_village_no, phone: u.phone, status: u.status,
    last_login_at: u.last_login_at, created_at: u.created_at
  };
}

router.get('/me', (req, res) => res.json(publicUser(req.user)));

// ── Children ───────────────────────────────────────────────────────────
const CHILD_SELECT = `
  SELECT c.*,
    (SELECT count(*)::int FROM medicine_logs m
      WHERE m.child_id = c.id AND m.status = 'กินยาแล้ว' AND m.taken_on > current_date - 30) AS doses_30d
  FROM children c`;

router.get('/children', h(async (req, res) => {
  const scope = villageScope(req.user);
  const rows = await query(
    `${CHILD_SELECT} WHERE c.is_active AND ($1::int IS NULL OR (c.village_no = $1 AND COALESCE(c.tambon, 'คลองหาด') = 'คลองหาด'))
     ORDER BY c.village_no NULLS LAST, c.name`,
    [scope]
  );
  res.json(rows);
}));

router.get('/children/:id', h(async (req, res) => {
  const scope = villageScope(req.user);
  const [child] = await query(
    `${CHILD_SELECT} WHERE c.id = $1 AND c.is_active AND ($2::int IS NULL OR (c.village_no = $2 AND COALESCE(c.tambon, 'คลองหาด') = 'คลองหาด'))`,
    [req.params.id, scope]
  );
  if (!child) return res.status(404).json({ error: 'ไม่พบข้อมูลเด็ก' });
  const medicineLogs = await query(
    'SELECT * FROM medicine_logs WHERE child_id = $1 ORDER BY taken_on DESC, taken_time DESC NULLS LAST, id DESC LIMIT 100',
    [child.id]
  );
  res.json({ ...child, medicine_logs: medicineLogs });
}));

router.post('/children', requireRole(...STAFF), h(async (req, res) => {
  const child = await insertChild(pool, req.body, req.user.id);
  await logActivity(req.user, 'เพิ่มข้อมูลเด็ก', `${child.name} (${child.village_name || '-'}) ${child.risk_level} ${child.total_score}/10`);
  res.status(201).json(child);
}));

router.put('/children/:id', requireRole(...STAFF), h(async (req, res) => {
  const child = await updateChild(pool, req.params.id, req.body, req.user.id);
  if (!child) return res.status(404).json({ error: 'ไม่พบข้อมูลเด็ก' });
  const action = req.query.source === 'assessment' ? 'ประเมินความเสี่ยง' : 'แก้ไขข้อมูลเด็ก';
  await logActivity(req.user, action, `${child.name} คะแนนรวม ${child.total_score}/10 (${child.risk_level})`);
  res.json(child);
}));

// Soft delete: the row and its medicine history are kept for audit.
router.delete('/children/:id', requireRole(...STAFF), h(async (req, res) => {
  const [child] = await query(
    'UPDATE children SET is_active = false, updated_by = $2, updated_at = now() WHERE id = $1 AND is_active RETURNING name',
    [req.params.id, req.user.id]
  );
  if (!child) return res.status(404).json({ error: 'ไม่พบข้อมูลเด็ก' });
  await logActivity(req.user, 'ลบข้อมูลเด็ก', child.name);
  res.json({ ok: true });
}));

// Bulk import from CSV (already parsed client-side). All-or-nothing: any invalid
// row aborts the whole import and reports every bad row.
router.post('/children/import', requireRole(...STAFF), h(async (req, res) => {
  const list = Array.isArray(req.body?.children) ? req.body.children : null;
  if (!list || list.length === 0) return res.status(400).json({ error: 'ไม่พบข้อมูลที่จะนำเข้า' });
  if (list.length > MAX_IMPORT_ROWS) return res.status(400).json({ error: `นำเข้าได้ไม่เกิน ${MAX_IMPORT_ROWS} แถวต่อครั้ง` });

  const result = await withTransaction((client) => importChildren(client, list, req.user.id));
  await logActivity(req.user, 'นำเข้าข้อมูลเด็ก', `เพิ่ม ${result.inserted} คน, อัปเดต ${result.updated} คน`);
  res.json(result);
}));

// ── Medicine logs ──────────────────────────────────────────────────────
router.post('/children/:id/medicine-logs', h(async (req, res) => {
  const scope = villageScope(req.user);
  const [child] = await query(
    `SELECT id, name FROM children WHERE id = $1 AND is_active
       AND ($2::int IS NULL OR (village_no = $2 AND COALESCE(tambon, 'คลองหาด') = 'คลองหาด'))`,
    [req.params.id, scope]
  );
  if (!child) return res.status(404).json({ error: 'ไม่พบข้อมูลเด็ก' });

  const { taken_on, taken_time, status, notes } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(taken_on || '')) return res.status(400).json({ error: 'กรุณาระบุวันที่กินยา' });
  if (taken_time && !/^\d{2}:\d{2}$/.test(taken_time)) return res.status(400).json({ error: 'รูปแบบเวลาไม่ถูกต้อง' });
  if (!['กินยาแล้ว', 'ไม่ได้กิน'].includes(status)) return res.status(400).json({ error: 'กรุณาระบุสถานะการกินยา' });
  if (new Date(taken_on) > new Date(Date.now() + 24 * 3600 * 1000)) return res.status(400).json({ error: 'วันที่กินยาต้องไม่เป็นวันในอนาคต' });

  const log = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO medicine_logs (child_id, taken_on, taken_time, status, notes, recorded_by, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [child.id, taken_on, taken_time || null, status, (notes || '').trim().slice(0, 500) || null, req.user.id, req.user.name]
    );
    if (status === 'กินยาแล้ว') {
      await client.query(
        `UPDATE children SET last_medication_at = GREATEST(COALESCE(last_medication_at, '-infinity'), ($2::date + COALESCE($3::time, '00:00'::time)) AT TIME ZONE 'Asia/Bangkok')
         WHERE id = $1`,
        [child.id, taken_on, taken_time || null]
      );
    }
    return rows[0];
  });
  await logActivity(req.user, 'บันทึกการกินยา', `${child.name} วันที่ ${taken_on}: ${status}`);
  res.status(201).json(log);
}));

// ── Activity log ───────────────────────────────────────────────────────
router.get('/activity-logs', requireRole(...STAFF), h(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(await query('SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT $1', [limit]));
}));

// ── Users (admin) ──────────────────────────────────────────────────────
router.get('/users', requireRole('admin'), h(async (req, res) => {
  const rows = await query(
    "SELECT * FROM users ORDER BY (status = 'Pending') DESC, status, name"
  );
  res.json(rows.map(publicUser));
}));

router.put('/users/:id', requireRole('admin'), h(async (req, res) => {
  const id = Number(req.params.id);
  const { role, status, assigned_village_no, phone } = req.body || {};
  if (!['admin', 'staff', 'vhv'].includes(role)) return res.status(400).json({ error: 'บทบาทไม่ถูกต้อง' });
  if (!['Pending', 'Active', 'Suspended'].includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  if (id === req.user.id && (role !== 'admin' || status !== 'Active')) {
    return res.status(400).json({ error: 'ไม่สามารถลดสิทธิ์หรือระงับบัญชีของตนเองได้' });
  }
  const villageNo = assigned_village_no === '' || assigned_village_no == null ? null : Number(assigned_village_no);
  if (role === 'vhv' && !(Number.isInteger(villageNo) && villageNo > 0)) {
    return res.status(400).json({ error: 'กรุณาเลือกหมู่บ้านที่ อสม. รับผิดชอบ' });
  }
  const [user] = await query(
    `UPDATE users SET role = $2, status = $3, assigned_village_no = $4, phone = $5, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, role, status, role === 'vhv' ? villageNo : null, (phone || '').trim().slice(0, 30) || null]
  );
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
  await logActivity(req.user, 'แก้ไขผู้ใช้งาน', `${user.name}: บทบาท ${user.role}, สถานะ ${user.status}`);
  res.json(publicUser(user));
}));

// ── Errors ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'ข้อมูลมีขนาดใหญ่เกินไป' });
  console.error('API error:', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' });
});

module.exports = router;
