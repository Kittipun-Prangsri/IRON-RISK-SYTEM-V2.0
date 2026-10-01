const express = require('express');
const { pool, query, withTransaction } = require('../db');
const { requireUser, requireRole, villageScope } = require('../auth');
const { logActivity } = require('../activity');
const { ValidationError, children, pregnancies } = require('../registries');

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

// ── Registries: children and pregnant women ───────────────────────────
// Both share the same routes: list, detail (+ medicine history), create, update,
// soft delete, CSV import and medicine logging. อสม. are limited to their หมู่
// within ต.คลองหาด for reads and medicine logs; writes are staff-only.
const VILLAGE_SCOPE = (col) =>
  `($SCOPE::int IS NULL OR (${col}village_no = $SCOPE AND COALESCE(${col}tambon, 'คลองหาด') = 'คลองหาด'))`;

function mountRegistry({ path, table, registry, logColumn, noun, maxScore }) {
  const scoped = (sql, scopeParam) => sql.replaceAll('$SCOPE', `$${scopeParam}`);
  const select = `
    SELECT t.*,
      (SELECT count(*)::int FROM medicine_logs m
        WHERE m.${logColumn} = t.id AND m.status = 'กินยาแล้ว' AND m.taken_on > current_date - 30) AS doses_30d
    FROM ${table} t`;
  const notFound = (res) => res.status(404).json({ error: `ไม่พบ${noun}` });
  const summary = (r) => `${r.name} คะแนนรวม ${r.total_score}/${maxScore} (${r.risk_level})`;

  router.get(path, h(async (req, res) => {
    const rows = await query(
      `${select} WHERE t.is_active AND ${scoped(VILLAGE_SCOPE('t.'), 1)}
       ORDER BY t.village_no NULLS LAST, t.name`,
      [villageScope(req.user)]
    );
    res.json(rows);
  }));

  router.get(`${path}/:id`, h(async (req, res) => {
    const [row] = await query(
      `${select} WHERE t.id = $1 AND t.is_active AND ${scoped(VILLAGE_SCOPE('t.'), 2)}`,
      [req.params.id, villageScope(req.user)]
    );
    if (!row) return notFound(res);
    const medicineLogs = await query(
      `SELECT * FROM medicine_logs WHERE ${logColumn} = $1
       ORDER BY taken_on DESC, taken_time DESC NULLS LAST, id DESC LIMIT 100`,
      [row.id]
    );
    res.json({ ...row, medicine_logs: medicineLogs });
  }));

  router.post(path, requireRole(...STAFF), h(async (req, res) => {
    const row = await registry.insert(pool, req.body, req.user.id);
    await logActivity(req.user, `เพิ่ม${noun}`, `${summary(row)} ${row.village_name || ''}`.trim());
    res.status(201).json(row);
  }));

  router.put(`${path}/:id`, requireRole(...STAFF), h(async (req, res) => {
    const row = await registry.update(pool, req.params.id, req.body, req.user.id);
    if (!row) return notFound(res);
    const action = req.query.source === 'assessment' ? `ประเมินความเสี่ยง (${noun.replace('ข้อมูล', '')})` : `แก้ไข${noun}`;
    await logActivity(req.user, action, summary(row));
    res.json(row);
  }));

  // Soft delete: the row and its medicine history are kept for audit.
  router.delete(`${path}/:id`, requireRole(...STAFF), h(async (req, res) => {
    const [row] = await query(
      `UPDATE ${table} SET is_active = false, updated_by = $2, updated_at = now() WHERE id = $1 AND is_active RETURNING name`,
      [req.params.id, req.user.id]
    );
    if (!row) return notFound(res);
    await logActivity(req.user, `ลบ${noun}`, row.name);
    res.json({ ok: true });
  }));

  // Bulk import from CSV (already parsed client-side). All-or-nothing: any invalid
  // row aborts the whole import and reports every bad row.
  router.post(`${path}/import`, requireRole(...STAFF), h(async (req, res) => {
    const body = req.body || {};
    const list = Array.isArray(body.rows) ? body.rows : Array.isArray(body.children) ? body.children : null;
    if (!list || list.length === 0) return res.status(400).json({ error: 'ไม่พบข้อมูลที่จะนำเข้า' });
    if (list.length > MAX_IMPORT_ROWS) return res.status(400).json({ error: `นำเข้าได้ไม่เกิน ${MAX_IMPORT_ROWS} แถวต่อครั้ง` });
    const result = await withTransaction((client) => registry.importRows(client, list, req.user.id));
    await logActivity(req.user, `นำเข้า${noun}`, `เพิ่ม ${result.inserted} คน, อัปเดต ${result.updated} คน`);
    res.json(result);
  }));

  router.post(`${path}/:id/medicine-logs`, h(async (req, res) => {
    const [row] = await query(
      `SELECT id, name FROM ${table} t WHERE t.id = $1 AND t.is_active AND ${scoped(VILLAGE_SCOPE('t.'), 2)}`,
      [req.params.id, villageScope(req.user)]
    );
    if (!row) return notFound(res);

    const { taken_on, taken_time, status, notes } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(taken_on || '')) return res.status(400).json({ error: 'กรุณาระบุวันที่กินยา' });
    if (taken_time && !/^\d{2}:\d{2}$/.test(taken_time)) return res.status(400).json({ error: 'รูปแบบเวลาไม่ถูกต้อง' });
    if (!['กินยาแล้ว', 'ไม่ได้กิน'].includes(status)) return res.status(400).json({ error: 'กรุณาระบุสถานะการกินยา' });
    if (new Date(taken_on) > new Date(Date.now() + 24 * 3600 * 1000)) return res.status(400).json({ error: 'วันที่กินยาต้องไม่เป็นวันในอนาคต' });

    const log = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO medicine_logs (${logColumn}, taken_on, taken_time, status, notes, recorded_by, recorded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [row.id, taken_on, taken_time || null, status, (notes || '').trim().slice(0, 500) || null, req.user.id, req.user.name]
      );
      if (status === 'กินยาแล้ว') {
        await client.query(
          `UPDATE ${table} SET last_medication_at = GREATEST(COALESCE(last_medication_at, '-infinity'), ($2::date + COALESCE($3::time, '00:00'::time)) AT TIME ZONE 'Asia/Bangkok')
           WHERE id = $1`,
          [row.id, taken_on, taken_time || null]
        );
      }
      return rows[0];
    });
    await logActivity(req.user, 'บันทึกการกินยา', `${row.name} วันที่ ${taken_on}: ${status}`);
    res.status(201).json(log);
  }));
}

mountRegistry({ path: '/children', table: 'children', registry: children, logColumn: 'child_id', noun: 'ข้อมูลเด็ก', maxScore: 10 });
mountRegistry({ path: '/pregnancies', table: 'pregnancies', registry: pregnancies, logColumn: 'pregnancy_id', noun: 'ข้อมูลหญิงตั้งครรภ์', maxScore: 12 });

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
