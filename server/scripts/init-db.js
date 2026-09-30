// Creates the tables in DB_NAME (idempotent). Usage: npm run db:init
const fs = require("fs");
const path = require("path");
const { getPool, close } = require("../src/db");

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const stmt of statements) await getPool().query(stmt);
  return statements.length;
}

if (require.main === module) {
  initDb()
    .then((n) => { console.log(`Schema applied (${n} statements).`); return close(); })
    .catch((err) => { console.error("db:init failed:", err.message); process.exit(1); });
}

module.exports = { initDb };
