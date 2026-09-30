// PostgreSQL (Supabase) access. SQL in this codebase uses "?" placeholders;
// they are rewritten to $1..$n here. All tables live in their own schema
// (DB_SCHEMA, default "iron_risk") — deliberately NOT "public", which Supabase
// exposes through its REST API.
const fs = require("fs");
const { Pool, types } = require("pg");
const { config } = require("./config");

// timestamp (without time zone) → "yyyy-MM-dd HH:mm:ss" string, no JS Date / TZ shifting.
types.setTypeParser(1114, (v) => (v === null ? null : v.replace("T", " ").slice(0, 19)));
// bigint (COUNT(*), identity ids) and numeric → JS numbers.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

let pool = null;

function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function sslOptions() {
  if (!config.db.ssl) return false;
  // With Supabase's CA certificate (Dashboard → Database → SSL) the server is verified;
  // without it the link is still encrypted but the certificate isn't checked.
  if (config.db.sslCaFile) return { ca: fs.readFileSync(config.db.sslCaFile, "utf8"), rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

function getPool() {
  if (!pool) {
    if (!config.db.url) throw new Error("DATABASE_URL is not set (Supabase → Connect → Session pooler connection string)");
    pool = new Pool({
      connectionString: config.db.url,
      ssl: sslOptions(),
      max: 10,
      // Fail with a clear error instead of hanging forever when the DB host is unreachable.
      connectionTimeoutMillis: 15000
    });
    // A dropped idle connection must not crash the process; the pool reconnects.
    pool.on("error", (err) => console.error("[db] idle connection error:", err.message));
  }
  return pool;
}

// Checks out a connection whose search_path is the app schema. Set once per
// physical connection, before its first use. Requires a session-level connection
// (Supabase *Session* pooler, port 5432) — not the transaction-mode pooler.
async function checkout() {
  const client = await getPool().connect();
  if (!client.ironRiskSchemaSet) {
    try {
      await client.query(`SET search_path TO ${config.db.schema}`);
      client.ironRiskSchemaSet = true;
    } catch (err) {
      client.release(err);
      throw err;
    }
  }
  return client;
}

async function query(sql, params) {
  const client = await checkout();
  try {
    return (await client.query(toPg(sql), params)).rows;
  } finally {
    client.release();
  }
}

// Runs fn(conn) in a transaction; conn.query(sql, params) returns rows.
async function transaction(fn) {
  const client = await checkout();
  const conn = { query: async (sql, params) => (await client.query(toPg(sql), params)).rows };
  try {
    await client.query("BEGIN");
    const result = await fn(conn);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
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

module.exports = { getPool, query, transaction, close, toPg, checkout };
