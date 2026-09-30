// Creates the schema + tables (idempotent). Usage: npm run db:init
const fs = require("fs");
const path = require("path");
const { config } = require("../src/config");
const { getPool, query, close } = require("../src/db");

async function initDb() {
  // Thai text needs a UTF8 database (SQL_ASCII would count bytes as characters
  // and store garbage). Supabase is UTF8; refuse anything else.
  const [enc] = await query("SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = current_database()");
  if (enc.encoding !== "UTF8") throw new Error(`Database encoding is ${enc.encoding}; it must be UTF8`);

  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8")
    .replace(/\{\{schema\}\}/g, config.db.schema);
  // One simple-protocol query: runs every statement (incl. $$ function bodies) in order.
  await getPool().query(sql);
  const rows = await query("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = ?", [config.db.schema]);
  return rows[0].n;
}

if (require.main === module) {
  initDb()
    .then((n) => { console.log(`Schema "${config.db.schema}" ready (${n} tables).`); return close(); })
    .catch((err) => {
      console.error("db:init failed:", err.message);
      if (/timeout|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/i.test(`${err.message} ${err.code}`)) {
        console.error("→ server เชื่อมต่อ Supabase ไม่ได้: ตรวจว่าใช้ Session pooler (…pooler.supabase.com:5432) และไฟร์วอลล์อนุญาตพอร์ต 5432 ออกภายนอก");
      }
      if (/password authentication failed/i.test(err.message)) console.error("→ รหัสผ่านใน DATABASE_URL ไม่ถูกต้อง");
      process.exit(1);
    });
}

module.exports = { initDb };
