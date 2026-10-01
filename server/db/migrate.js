// Runs every *.sql file in this folder, in name order, against DATABASE_URL.
// Each file must be idempotent. "__SCHEMA__" in the SQL is replaced with DB_SCHEMA,
// so a scratch schema can be used for testing.
// Usage: node db/migrate.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, schema } = require('../src/db');

(async () => {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/__SCHEMA__/g, schema);
    await pool.query(sql);
    console.log(`applied ${file}`);
  }
  await pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
