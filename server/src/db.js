import pg from "pg";

/** @type {pg.Pool|null} */
let pool = null;

/**
 * Get or create the shared connection pool.
 * @param {string} [connectionString] DATABASE_URL
 * @returns {pg.Pool}
 */
export function getPool(connectionString) {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

/**
 * Run a query against the pool.
 * @param {string} text
 * @param {any[]} [params]
 */
export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

/** Gracefully close the pool. */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
