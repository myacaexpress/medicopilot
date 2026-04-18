import { query } from "../db.js";
import { TRAINING_SCENARIOS } from "../data/training-scenarios-seed.js";

/** In-memory scenario cache (populated on first fetch or seed). */
let scenarioCache = null;

/**
 * Seed scenarios into DB if the table is empty.
 * Returns the full list of scenarios.
 */
async function ensureSeeded() {
  if (scenarioCache) return scenarioCache;
  const { rows } = await query("SELECT count(*)::int AS c FROM training_scenarios");
  if (rows[0].c === 0) {
    for (const s of TRAINING_SCENARIOS) {
      await query(
        `INSERT INTO training_scenarios
           (id, title, difficulty, persona_name, persona_age, persona_state,
            situation, opening_lines, carrier_prefs, objections, medications,
            success_criteria, hidden_curveball)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id, s.title, s.difficulty, s.persona_name, s.persona_age,
          s.persona_state, s.situation, s.opening_lines, s.carrier_prefs,
          s.objections, s.medications, s.success_criteria, s.hidden_curveball,
        ]
      );
    }
  }
  const all = await query("SELECT * FROM training_scenarios ORDER BY difficulty, id");
  scenarioCache = all.rows;
  return scenarioCache;
}

/** Clear scenario cache (used after manual DB changes). */
export function clearScenarioCache() {
  scenarioCache = null;
}

/**
 * Get a single scenario by ID (from cache).
 * @param {string} id
 */
export async function getScenarioById(id) {
  const scenarios = await ensureSeeded();
  return scenarios.find((s) => s.id === id) || null;
}

/**
 * Admin auth middleware — checks x-admin-key header or ?key= query param.
 */
function adminAuth(app) {
  return async (req, reply) => {
    const adminKey = app.env?.trainingAdminKey;
    if (!adminKey) {
      reply.code(503).send({ error: "Admin key not configured" });
      return;
    }
    const provided = req.headers["x-admin-key"] || req.query?.key;
    if (provided !== adminKey) {
      reply.code(401).send({ error: "Invalid admin key" });
      return;
    }
  };
}

/**
 * @param {import("fastify").FastifyInstance} app
 */
export default async function trainingRoutes(app) {
  const checkAdmin = adminAuth(app);

  // ── Public routes (tester-facing) ────────────────────────────────

  app.get("/api/training/scenarios", async () => {
    const scenarios = await ensureSeeded();
    return scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      difficulty: s.difficulty,
      persona_name: s.persona_name,
      persona_age: s.persona_age,
      persona_state: s.persona_state,
      situation: s.situation,
      opening_lines: s.opening_lines,
      medications: s.medications,
      success_criteria: s.success_criteria,
    }));
  });

  app.post("/api/training/sessions", async (req, reply) => {
    const { scenario_id, tester_name, master_prompt_version } = req.body || {};
    if (!scenario_id || !tester_name) {
      return reply.code(400).send({ error: "scenario_id and tester_name required" });
    }
    const scenario = await getScenarioById(scenario_id);
    if (!scenario) {
      return reply.code(404).send({ error: "Scenario not found" });
    }
    const { rows } = await query(
      `INSERT INTO training_sessions (scenario_id, tester_name, master_prompt_version)
       VALUES ($1, $2, $3) RETURNING *`,
      [scenario_id, tester_name, master_prompt_version || null]
    );
    reply.code(201);
    return rows[0];
  });

  app.patch("/api/training/sessions/:id", async (req, reply) => {
    const { id } = req.params;
    const { rating, feedback_text, duration_ms } = req.body || {};
    const sets = [];
    const params = [];
    let idx = 1;

    if (rating != null) {
      sets.push(`rating = $${idx++}`);
      params.push(rating);
    }
    if (feedback_text != null) {
      sets.push(`feedback_text = $${idx++}`);
      params.push(feedback_text);
    }
    if (duration_ms != null) {
      sets.push(`duration_ms = $${idx++}`);
      params.push(duration_ms);
    }
    sets.push(`ended_at = $${idx++}`);
    params.push(new Date().toISOString());
    params.push(id);

    if (sets.length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    const { rows } = await query(
      `UPDATE training_sessions SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: "Session not found" });
    }
    return rows[0];
  });

  app.post("/api/training/flags", async (req, reply) => {
    const { session_id, timestamp_ms, note, flag_type } = req.body || {};
    if (!session_id || timestamp_ms == null) {
      return reply.code(400).send({ error: "session_id and timestamp_ms required" });
    }
    const { rows } = await query(
      `INSERT INTO training_flags (session_id, timestamp_ms, note, flag_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [session_id, timestamp_ms, note || "", flag_type || "general"]
    );
    reply.code(201);
    return rows[0];
  });

  // ── Admin routes ─────────────────────────────────────────────────

  app.get("/api/training/admin/sessions", { preHandler: checkAdmin }, async (req) => {
    const limit = Math.min(parseInt(req.query?.limit) || 50, 200);
    const offset = parseInt(req.query?.offset) || 0;
    const scenario_id = req.query?.scenario_id;

    let sql = `SELECT s.*, sc.title AS scenario_title, sc.difficulty
               FROM training_sessions s
               JOIN training_scenarios sc ON sc.id = s.scenario_id`;
    const params = [];
    if (scenario_id) {
      sql += ` WHERE s.scenario_id = $1`;
      params.push(scenario_id);
    }
    sql += ` ORDER BY s.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    return rows;
  });

  app.get("/api/training/admin/sessions/:id", { preHandler: checkAdmin }, async (req, reply) => {
    const { id } = req.params;
    const sessionRes = await query(
      `SELECT s.*, sc.title AS scenario_title, sc.difficulty, sc.persona_name,
              sc.situation, sc.success_criteria, sc.hidden_curveball
       FROM training_sessions s
       JOIN training_scenarios sc ON sc.id = s.scenario_id
       WHERE s.id = $1`,
      [id]
    );
    if (sessionRes.rows.length === 0) {
      return reply.code(404).send({ error: "Session not found" });
    }
    const [flagsRes, transcriptsRes, suggestionsRes] = await Promise.all([
      query(
        `SELECT * FROM training_flags WHERE session_id = $1 ORDER BY timestamp_ms`,
        [id]
      ),
      query(
        `SELECT speaker, text, timestamp_ms FROM training_transcripts WHERE session_id = $1 ORDER BY timestamp_ms`,
        [id]
      ),
      query(
        `SELECT say_this, trigger_info, call_stage, follow_up_questions, timestamp_ms FROM training_ai_suggestions WHERE session_id = $1 ORDER BY timestamp_ms`,
        [id]
      ),
    ]);
    return {
      ...sessionRes.rows[0],
      flags: flagsRes.rows,
      transcripts: transcriptsRes.rows,
      ai_suggestions: suggestionsRes.rows,
    };
  });

  app.get("/api/training/admin/stats", { preHandler: checkAdmin }, async () => {
    const totals = await query(`
      SELECT
        count(*)::int AS total_sessions,
        count(CASE WHEN rating IS NOT NULL THEN 1 END)::int AS rated_sessions,
        round(avg(rating), 2)::float AS avg_rating,
        round(avg(duration_ms) / 1000, 1)::float AS avg_duration_sec,
        count(DISTINCT tester_name)::int AS unique_testers
      FROM training_sessions
    `);
    const byDifficulty = await query(`
      SELECT sc.difficulty,
        count(*)::int AS sessions,
        round(avg(s.rating), 2)::float AS avg_rating
      FROM training_sessions s
      JOIN training_scenarios sc ON sc.id = s.scenario_id
      GROUP BY sc.difficulty
      ORDER BY sc.difficulty
    `);
    const byScenario = await query(`
      SELECT s.scenario_id, sc.title,
        count(*)::int AS sessions,
        round(avg(s.rating), 2)::float AS avg_rating
      FROM training_sessions s
      JOIN training_scenarios sc ON sc.id = s.scenario_id
      GROUP BY s.scenario_id, sc.title
      ORDER BY sessions DESC
      LIMIT 10
    `);
    const recentFlags = await query(`
      SELECT f.*, s.tester_name, s.scenario_id
      FROM training_flags f
      JOIN training_sessions s ON s.id = f.session_id
      ORDER BY f.created_at DESC
      LIMIT 20
    `);
    return {
      ...totals.rows[0],
      by_difficulty: byDifficulty.rows,
      top_scenarios: byScenario.rows,
      recent_flags: recentFlags.rows,
    };
  });
}
