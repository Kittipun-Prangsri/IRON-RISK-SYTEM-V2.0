const mysql = require("mysql2/promise");
const { config } = require("./config");

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db,
      charset: "utf8mb4",
      // DATETIME values are Asia/Bangkok wall-clock time; read them back as strings
      // so no driver-side timezone shifting happens.
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return pool;
}

async function query(sql, params) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

// Runs fn(conn) inside a transaction; commits on success, rolls back on error.
async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, transaction, close };
