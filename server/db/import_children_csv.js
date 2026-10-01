// One-off import of a children CSV (header row = field names, e.g. the reviewed
// output of the public.children repair) into DB_SCHEMA.
// Usage: node db/import_children_csv.js <file.csv>            (validate only)
//        node db/import_children_csv.js <file.csv> --commit   (write)
require('dotenv').config();
const fs = require('fs');
const { pool, withTransaction, schema } = require('../src/db');
const { importChildren, ValidationError } = require('../src/children');

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

(async () => {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error('usage: node db/import_children_csv.js <file.csv> [--commit]');
  const [header, ...rows] = parseCSV(fs.readFileSync(file, 'utf8'));
  // The repair output's ids came from the corrupted sheet; new rows get fresh ids.
  const list = rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
    .map(({ id, ...rest }) => rest); // eslint-disable-line no-unused-vars
  const commit = flag === '--commit';

  try {
    const result = await withTransaction(async (client) => {
      const r = await importChildren(client, list, null);
      if (!commit) throw Object.assign(new Error('dry run'), { dryRun: r });
      return r;
    });
    console.log(`imported into ${schema}:`, result);
  } catch (err) {
    if (err.dryRun) console.log(`dry run OK (nothing written) — would insert ${err.dryRun.inserted} into ${schema}. Re-run with --commit.`);
    else if (err instanceof ValidationError) console.error(err.message, err.details);
    else throw err;
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
