const crypto = require('crypto');

class ValidationError extends Error {}

// Shared persistence for a scored registry table (children, pregnancies): input
// validation, server-side scoring, insert, partial update and bulk import.
//
// spec: { table, idPrefix, text: [], enums: {field: options}, numbers: {field: rule},
//         dates: {field: {past?: true}}, arrays: {field: options}, required: [],
//         score: (row) => scoreFields, scoreFields: [] }
function createRegistry(spec) {
  const dates = spec.dates || {};
  const arrays = spec.arrays || {};
  const editable = [...spec.text, ...Object.keys(spec.enums), ...Object.keys(spec.numbers), ...Object.keys(dates), ...Object.keys(arrays)];
  const columns = [...editable, ...spec.scoreFields];
  const columnType = (c) =>
    c in spec.numbers ? (spec.numbers[c].int ? 'integer' : 'numeric')
      : c in dates ? 'date'
        : c in arrays ? 'text[]'
          : spec.scoreFields.includes(c) && c !== 'risk_level' ? 'smallint' : 'text';

  const newId = () => `${spec.idPrefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  // Validates and normalizes input; empty strings become null. Throws
  // ValidationError listing every problem.
  function normalize(input) {
    const out = {};
    const errors = [];
    const raw = (f) => (input[f] === undefined || input[f] === null ? '' : String(input[f]).trim());
    for (const f of spec.text) out[f] = raw(f) === '' ? null : raw(f).slice(0, 2000);
    for (const [f, options] of Object.entries(spec.enums)) {
      const v = raw(f);
      if (v === '') out[f] = null;
      else if (options.includes(v)) out[f] = v;
      else errors.push(`${f}: ค่า "${v}" ไม่ถูกต้อง`);
    }
    for (const [f, rule] of Object.entries(spec.numbers)) {
      const v = raw(f);
      if (v === '') { out[f] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < rule.min || n > rule.max || (rule.int && !Number.isInteger(n))) errors.push(`${f}: ค่า "${v}" ไม่ถูกต้อง`);
      else out[f] = n;
    }
    for (const [f, rule] of Object.entries(dates)) {
      const v = raw(f).slice(0, 10);
      if (v === '') { out[f] = null; continue; }
      const d = new Date(`${v}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime())) errors.push(`${f}: วันที่ "${v}" ไม่ถูกต้อง`);
      else if (rule.past && d.getTime() > Date.now() + 24 * 3600 * 1000) errors.push(`${f}: ต้องไม่เป็นวันในอนาคต`);
      else out[f] = v;
    }
    for (const [f, options] of Object.entries(arrays)) {
      const v = input[f];
      const list = Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split('|') : [];
      const cleaned = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))];
      const bad = cleaned.filter((x) => !options.includes(x));
      if (bad.length) errors.push(`${f}: ค่า "${bad.join(', ')}" ไม่ถูกต้อง`);
      else out[f] = cleaned;
    }
    for (const f of spec.required || []) if (out[f] === null || out[f] === undefined) errors.push(`${f}: จำเป็นต้องกรอก`);
    if (errors.length) throw new ValidationError(errors.join(', '));
    return out;
  }

  const withScores = (row) => ({ ...row, ...spec.score(row) });

  async function insert(db, input, userId, id = newId()) {
    const row = withScores(normalize(input));
    const placeholders = columns.map((_, i) => `$${i + 3}`).join(', ');
    const { rows } = await db.query(
      `INSERT INTO ${spec.table} (id, created_by, updated_by, ${columns.join(', ')})
       VALUES ($1, $2, $2, ${placeholders}) RETURNING *`,
      [id, userId, ...columns.map((c) => row[c])]
    );
    return rows[0];
  }

  // Partial update: fields absent from `input` keep their stored value.
  async function update(db, id, input, userId) {
    const { rows: existing } = await db.query(`SELECT * FROM ${spec.table} WHERE id = $1 AND is_active`, [id]);
    if (!existing[0]) return null;
    const merged = {};
    for (const f of editable) merged[f] = f in input ? input[f] : existing[0][f];
    const row = withScores(normalize(merged));
    const sets = columns.map((c, i) => `${c} = $${i + 3}`).join(', ');
    const { rows } = await db.query(
      `UPDATE ${spec.table} SET ${sets}, updated_by = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, userId, ...columns.map((c) => row[c])]
    );
    return rows[0];
  }

  // Bulk upsert in a constant number of queries (the DB is a network hop away, so
  // per-row round trips make large imports crawl). Rows whose id matches an active
  // record update it — missing columns keep their stored value — and all other rows
  // are inserted. Validates everything before writing; throws ValidationError with
  // per-row details if any row is invalid.
  async function importRows(db, list, userId) {
    const ids = list.map((r) => r.id).filter(Boolean);
    const { rows: existingRows } = await db.query(`SELECT * FROM ${spec.table} WHERE id = ANY($1) AND is_active`, [ids]);
    const existing = new Map(existingRows.map((r) => [r.id, r]));

    const inserts = [], updates = [], errors = [];
    for (const [i, input] of list.entries()) {
      const base = input.id && existing.get(input.id);
      const merged = {};
      for (const f of editable) merged[f] = base && !(f in input) ? base[f] : input[f];
      try {
        const row = withScores(normalize(merged));
        if (base) updates.push({ ...row, id: base.id });
        else inserts.push({ ...row, id: newId() });
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        errors.push({ row: i + 1, name: input.name || '', error: err.message });
      }
    }
    if (errors.length) {
      const e = new ValidationError('ข้อมูลบางแถวไม่ถูกต้อง ยังไม่ได้นำเข้า');
      e.details = errors;
      throw e;
    }

    const recordset = `jsonb_to_recordset($1) AS x(id text, ${columns.map((c) => `${c} ${columnType(c)}`).join(', ')})`;
    if (inserts.length) {
      await db.query(
        `INSERT INTO ${spec.table} (id, created_by, updated_by, ${columns.join(', ')})
         SELECT x.id, $2, $2, ${columns.map((c) => `x.${c}`).join(', ')} FROM ${recordset}`,
        [JSON.stringify(inserts), userId]
      );
    }
    if (updates.length) {
      await db.query(
        `UPDATE ${spec.table} c SET ${columns.map((col) => `${col} = x.${col}`).join(', ')}, updated_by = $2, updated_at = now()
         FROM ${recordset} WHERE c.id = x.id`,
        [JSON.stringify(updates), userId]
      );
    }
    return { inserted: inserts.length, updated: updates.length };
  }

  return { normalize, insert, update, importRows, editable };
}

module.exports = { ValidationError, createRegistry };
