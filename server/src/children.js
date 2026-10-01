const crypto = require('crypto');
const {
  NUTRITION_OPTIONS, IRON_OPTIONS, FOOD_OPTIONS, SOCIAL_OPTIONS, scoreChild
} = require('./scoring');

const TEXT_FIELDS = ['name', 'age', 'house_number', 'village_name', 'tambon', 'amphoe', 'province', 'caregiver_name', 'notes'];
const ENUM_FIELDS = {
  nutrition_status: NUTRITION_OPTIONS,
  iron_status: IRON_OPTIONS,
  food_behavior: FOOD_OPTIONS,
  social_status: SOCIAL_OPTIONS
};
const NUMBER_FIELDS = {
  village_no: { min: 1, max: 99, int: true },
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  hct: { min: 1, max: 80 },
  weight_kg: { min: 0.5, max: 100 },
  height_cm: { min: 20, max: 200 }
};
const EDITABLE_FIELDS = [...TEXT_FIELDS, ...Object.keys(ENUM_FIELDS), ...Object.keys(NUMBER_FIELDS)];
const SCORE_FIELDS = ['hct_score', 'nutrition_score', 'iron_score', 'food_score', 'social_score', 'total_score', 'risk_level'];

class ValidationError extends Error {}

function newChildId() {
  return `CHILD_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// Validates and normalizes user input. Returns only the editable fields, with
// empty strings turned into null. Throws ValidationError listing every problem.
function normalizeChild(input) {
  const out = {};
  const errors = [];
  for (const f of TEXT_FIELDS) {
    const v = input[f];
    out[f] = v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, 2000);
  }
  for (const [f, options] of Object.entries(ENUM_FIELDS)) {
    const v = input[f] === undefined || input[f] === null ? '' : String(input[f]).trim();
    if (v === '') out[f] = null;
    else if (options.includes(v)) out[f] = v;
    else errors.push(`${f}: ค่า "${v}" ไม่ถูกต้อง`);
  }
  for (const [f, rule] of Object.entries(NUMBER_FIELDS)) {
    const raw = input[f] === undefined || input[f] === null ? '' : String(input[f]).trim();
    if (raw === '') { out[f] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < rule.min || n > rule.max || (rule.int && !Number.isInteger(n))) {
      errors.push(`${f}: ค่า "${raw}" ไม่ถูกต้อง`);
    } else {
      out[f] = n;
    }
  }
  if (!out.name) errors.push('name: กรุณากรอกชื่อเด็ก');
  if (errors.length) throw new ValidationError(errors.join(', '));
  return out;
}

function withScores(child) {
  return { ...child, ...scoreChild(child) };
}

async function insertChild(db, input, userId, id = newChildId()) {
  const child = withScores(normalizeChild(input));
  const cols = [...EDITABLE_FIELDS, ...SCORE_FIELDS];
  const values = cols.map((c) => child[c]);
  const placeholders = cols.map((_, i) => `$${i + 3}`).join(', ');
  const { rows } = await db.query(
    `INSERT INTO children (id, created_by, updated_by, ${cols.join(', ')})
     VALUES ($1, $2, $2, ${placeholders}) RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0];
}

// Partial update: fields absent from `input` keep their stored value.
async function updateChild(db, id, input, userId) {
  const { rows: existing } = await db.query('SELECT * FROM children WHERE id = $1 AND is_active', [id]);
  if (!existing[0]) return null;
  const merged = {};
  for (const f of EDITABLE_FIELDS) merged[f] = f in input ? input[f] : existing[0][f];
  const child = withScores(normalizeChild(merged));
  const cols = [...EDITABLE_FIELDS, ...SCORE_FIELDS];
  const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
  const { rows } = await db.query(
    `UPDATE children SET ${sets}, updated_by = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, userId, ...cols.map((c) => child[c])]
  );
  return rows[0];
}

// Postgres types for jsonb_to_recordset in the bulk import.
const COLUMN_TYPES = {
  village_no: 'integer', latitude: 'numeric', longitude: 'numeric', hct: 'numeric',
  weight_kg: 'numeric', height_cm: 'numeric', hct_score: 'smallint', nutrition_score: 'smallint',
  iron_score: 'smallint', food_score: 'smallint', social_score: 'smallint', total_score: 'smallint'
};
const recordsetDef = (cols) => cols.map((c) => `${c} ${COLUMN_TYPES[c] || 'text'}`).join(', ');

// Bulk upsert in a constant number of queries (the DB is a network hop away, so
// per-row round trips make large imports crawl). Rows whose id matches an active
// child update it — columns missing from the row keep their stored value — and all
// other rows are inserted as new children. Validates everything before writing;
// throws ValidationError with per-row details if any row is invalid.
async function importChildren(db, list, userId) {
  const ids = list.map((r) => r.id).filter(Boolean);
  const { rows: existingRows } = await db.query('SELECT * FROM children WHERE id = ANY($1) AND is_active', [ids]);
  const existing = new Map(existingRows.map((r) => [r.id, r]));

  const inserts = [], updates = [], errors = [];
  for (const [i, row] of list.entries()) {
    const base = row.id && existing.get(row.id);
    const merged = {};
    for (const f of EDITABLE_FIELDS) merged[f] = base && !(f in row) ? base[f] : row[f];
    try {
      const child = withScores(normalizeChild(merged));
      if (base) updates.push({ ...child, id: base.id });
      else inserts.push({ ...child, id: newChildId() });
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      errors.push({ row: i + 1, name: row.name || '', error: err.message });
    }
  }
  if (errors.length) {
    const e = new ValidationError('ข้อมูลบางแถวไม่ถูกต้อง ยังไม่ได้นำเข้า');
    e.details = errors;
    throw e;
  }

  const cols = [...EDITABLE_FIELDS, ...SCORE_FIELDS];
  if (inserts.length) {
    await db.query(
      `INSERT INTO children (id, created_by, updated_by, ${cols.join(', ')})
       SELECT x.id, $2, $2, ${cols.map((c) => `x.${c}`).join(', ')}
       FROM jsonb_to_recordset($1) AS x(id text, ${recordsetDef(cols)})`,
      [JSON.stringify(inserts), userId]
    );
  }
  if (updates.length) {
    await db.query(
      `UPDATE children c SET ${cols.map((col) => `${col} = x.${col}`).join(', ')}, updated_by = $2, updated_at = now()
       FROM jsonb_to_recordset($1) AS x(id text, ${recordsetDef(cols)})
       WHERE c.id = x.id`,
      [JSON.stringify(updates), userId]
    );
  }
  return { inserted: inserts.length, updated: updates.length };
}

module.exports = { ValidationError, normalizeChild, insertChild, updateChild, importChildren, newChildId, EDITABLE_FIELDS };
