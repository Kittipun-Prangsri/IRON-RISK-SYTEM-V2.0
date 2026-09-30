// Creates the schema + tables (idempotent). Usage: npm run db:init
const fs = require("fs");
const path = require("path");
const { config } = require("../src/config");
const { getPool, query, close } = require("../src/db");

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  
  // Split on ';' but avoid splitting within strings/comments if possible.
  // For a simple schema.sql, splitting on ';\n' is usually sufficient.
  const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (err) {
      if (!err.message.includes("Duplicate key name")) {
        console.error("Error executing statement:", stmt.substring(0, 50) + "...");
        throw err;
      }
    }
  }
  
  const tables = await query("SHOW TABLES");
  return tables.length;
}

if (require.main === module) {
  initDb()
    .then((n) => { console.log(`Database ready (${n} tables).`); return close(); })
    .catch((err) => {
      console.error("db:init failed:", err.message);
      if (/timeout|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/i.test(`${err.message} ${err.code}`)) {
        console.error("→ server เชื่อมต่อ MySQL ไม่ได้: ตรวจสอบ IP และพอร์ตให้ถูกต้อง");
      }
      if (/Access denied/i.test(err.message)) console.error("→ รหัสผ่านหรือ User ใน DB_USER/DB_PASSWORD ไม่ถูกต้อง");
      if (/Unknown database/i.test(err.message)) console.error(`→ ไม่พบฐานข้อมูล "${config.db.database}" (กรุณาสร้างฐานข้อมูลนี้ใน MySQL ก่อน)`);
      process.exit(1);
    });
}

module.exports = { initDb };
