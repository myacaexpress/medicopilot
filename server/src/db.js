/**
 * Database connection for MediCopilot server.
 *
 * Uses Neon Postgres via DATABASE_URL. If DATABASE_URL is unset,
 * training endpoints will return 503 with a clear message.
 */

import pg from "pg";

/** @type {pg.Pool|null} */
let pool = null;

export function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  return pool;
}

export async function initDb(log) {
  const p = getPool();
  if (!p) {
    log?.warn("db: DATABASE_URL unset — training persistence disabled");
    return false;
  }
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tester_name text NOT NULL,
        scenario_id text,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        transcript jsonb DEFAULT '[]'::jsonb,
        ai_suggestions jsonb DEFAULT '[]'::jsonb,
        summary text
      );
      CREATE TABLE IF NOT EXISTS training_flags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
        tester_name text NOT NULL,
        created_at timestamptz DEFAULT now(),
        ts_in_call_seconds int,
        transcript_context jsonb,
        ai_suggestion_shown jsonb,
        feedback_type text,
        feedback_text text,
        suggested_fix text
      );
    `);
    log?.info("db: training tables ready");
    return true;
  } catch (err) {
    log?.error({ err: err.message }, "db: migration failed");
    return false;
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
