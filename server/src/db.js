const { Pool, types } = require('pg');

// Return NUMERIC (hct, weight, coordinates) and BIGINT (ids, counts) as JS numbers;
// every value we store fits comfortably in a double.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : parseInt(v, 10)));
// Keep DATE as 'YYYY-MM-DD'; converting to a JS Date shifts it by the server's UTC offset.
types.setTypeParser(types.builtins.DATE, (v) => v);

// All app tables live in DB_SCHEMA (default iron_risk_v2), which the Supabase REST API
// does not expose. Queries use unqualified table names via search_path.
// ("iron_risk" holds tables from an earlier version with a different layout.)
const schema = process.env.DB_SCHEMA || 'iron_risk_v2';
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Invalid DB_SCHEMA: ${schema}`);

// TLS for remote databases (Supabase); a PostgreSQL on the same server needs none.
// Override with DB_SSL=true/false.
const dbHost = (() => { try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ''; } })();
const useSsl = process.env.DB_SSL ? process.env.DB_SSL === 'true' : !['localhost', '127.0.0.1', '::1', ''].includes(dbHost);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  options: `-c search_path=${schema}`,
  max: 5,
  // Fail fast instead of hanging the request (and the Next.js proxy) when the
  // database is unreachable.
  connectionTimeoutMillis: 10000
});
pool.on('error', (err) => console.error('Postgres pool error:', err.message));

async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction, schema };
