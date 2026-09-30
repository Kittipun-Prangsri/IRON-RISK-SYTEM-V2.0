const mysql = require("mysql2/promise");
const { config } = require("./config");

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db.url || {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection immediately
    pool.getConnection().then(conn => {
      conn.release();
    }).catch(err => {
      console.error("[db] Error connecting to MySQL:", err.message);
    });
  }
  return pool;
}

async function checkout() {
  const client = await getPool().getConnection();
  return client;
}

async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

// Runs fn(conn) in a transaction; conn.query(sql, params) returns rows.
async function transaction(fn) {
  const client = await checkout();
  const conn = { 
    query: async (sql, params) => {
      const [rows] = await client.execute(sql, params);
      return rows;
    }
  };
  
  try {
    await client.beginTransaction();
    const result = await fn(conn);
    await client.commit();
    return result;
  } catch (err) {
    await client.rollback().catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Keep toPg as an identity function in case other modules import it
function toPg(sql) {
  return sql;
}

module.exports = { getPool, query, transaction, close, toPg, checkout };
