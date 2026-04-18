/**
 * Training platform REST endpoints.
 *
 * No auth guards — internal testing only.
 * TODO: gate these endpoints by user role at P5.
 */

import { getPool } from "../db.js";

function requireDb(reply) {
  const pool = getPool();
  if (!pool) {
    reply.code(503).send({ error: "DATABASE_URL not configured — training persistence unavailable" });
    return null;
  }
  return pool;
}

/** @param {import("fastify").FastifyInstance} app */
export default async function trainingRoutes(app) {

  // ── Tester identity ──────────────────────────────────────────
  app.post("/api/training/tester", async (req, reply) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }
    return { ok: true, name: name.trim() };
  });

  // ── Session lifecycle ────────────────────────────────────────
  app.post("/api/training/session/start", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { testerName, scenarioId } = req.body ?? {};
    if (!testerName) return reply.code(400).send({ error: "testerName is required" });
    const { rows } = await pool.query(
      `INSERT INTO training_sessions (tester_name, scenario_id)
       VALUES ($1, $2) RETURNING *`,
      [testerName.trim(), scenarioId || null]
    );
    return rows[0];
  });

  app.post("/api/training/session/end", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { sessionId, summary } = req.body ?? {};
    if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
    const { rows } = await pool.query(
      `UPDATE training_sessions SET ended_at = now(), summary = COALESCE($2, summary)
       WHERE id = $1 RETURNING *`,
      [sessionId, summary || null]
    );
    if (!rows.length) return reply.code(404).send({ error: "session not found" });
    return rows[0];
  });

  // ── Append transcript utterance ──────────────────────────────
  app.post("/api/training/transcript-append", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { sessionId, utterance } = req.body ?? {};
    if (!sessionId || !utterance) return reply.code(400).send({ error: "sessionId and utterance required" });
    const { rows } = await pool.query(
      `UPDATE training_sessions
       SET transcript = transcript || $2::jsonb
       WHERE id = $1 RETURNING id`,
      [sessionId, JSON.stringify([utterance])]
    );
    if (!rows.length) return reply.code(404).send({ error: "session not found" });
    return { ok: true };
  });

  // ── Append AI suggestion ─────────────────────────────────────
  app.post("/api/training/suggestion-append", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { sessionId, suggestion } = req.body ?? {};
    if (!sessionId || !suggestion) return reply.code(400).send({ error: "sessionId and suggestion required" });
    const { rows } = await pool.query(
      `UPDATE training_sessions
       SET ai_suggestions = ai_suggestions || $2::jsonb
       WHERE id = $1 RETURNING id`,
      [sessionId, JSON.stringify([suggestion])]
    );
    if (!rows.length) return reply.code(404).send({ error: "session not found" });
    return { ok: true };
  });

  // ── Flag a moment ────────────────────────────────────────────
  app.post("/api/training/flag", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { sessionId, testerName, tsInCallSeconds, transcriptContext, aiSuggestionShown, feedbackType, feedbackText, suggestedFix } = req.body ?? {};
    if (!sessionId || !testerName) return reply.code(400).send({ error: "sessionId and testerName required" });
    const { rows } = await pool.query(
      `INSERT INTO training_flags
       (session_id, tester_name, ts_in_call_seconds, transcript_context, ai_suggestion_shown, feedback_type, feedback_text, suggested_fix)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sessionId, testerName, tsInCallSeconds || null, transcriptContext ? JSON.stringify(transcriptContext) : null, aiSuggestionShown ? JSON.stringify(aiSuggestionShown) : null, feedbackType || null, feedbackText || null, suggestedFix || null]
    );
    return rows[0];
  });

  // ── Admin: list sessions ─────────────────────────────────────
  app.get("/api/training/sessions", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { tester, scenario, from, to, limit } = req.query;
    let sql = `SELECT s.*, (SELECT count(*) FROM training_flags f WHERE f.session_id = s.id) AS flag_count
               FROM training_sessions s WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (tester) { sql += ` AND s.tester_name ILIKE $${idx++}`; params.push(`%${tester}%`); }
    if (scenario) { sql += ` AND s.scenario_id = $${idx++}`; params.push(scenario); }
    if (from) { sql += ` AND s.started_at >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND s.started_at <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY s.started_at DESC LIMIT $${idx++}`;
    params.push(Math.min(Number(limit) || 100, 500));
    const { rows } = await pool.query(sql, params);
    return rows;
  });

  // ── Admin: session detail ────────────────────────────────────
  app.get("/api/training/sessions/:id", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { id } = req.params;
    const sRes = await pool.query(`SELECT * FROM training_sessions WHERE id = $1`, [id]);
    if (!sRes.rows.length) return reply.code(404).send({ error: "session not found" });
    const fRes = await pool.query(
      `SELECT * FROM training_flags WHERE session_id = $1 ORDER BY created_at`, [id]
    );
    return { session: sRes.rows[0], flags: fRes.rows };
  });

  // ── Admin: session as markdown ───────────────────────────────
  app.get("/api/training/sessions/:id/markdown", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const { id } = req.params;
    const sRes = await pool.query(`SELECT * FROM training_sessions WHERE id = $1`, [id]);
    if (!sRes.rows.length) return reply.code(404).send({ error: "session not found" });
    const session = sRes.rows[0];
    const fRes = await pool.query(
      `SELECT * FROM training_flags WHERE session_id = $1 ORDER BY created_at`, [id]
    );
    const flags = fRes.rows;
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    const suggestions = Array.isArray(session.ai_suggestions) ? session.ai_suggestions : [];

    let md = `# Training Session: ${session.tester_name}\n\n`;
    md += `**Scenario:** ${session.scenario_id || "Free practice"}\n`;
    md += `**Started:** ${session.started_at}\n`;
    md += `**Ended:** ${session.ended_at || "In progress"}\n`;
    if (session.summary) md += `**Notes:** ${session.summary}\n`;
    md += `\n---\n\n## Transcript\n\n`;
    for (const u of transcript) {
      const role = u.speaker === "agent" ? "**Agent**" : "**Client**";
      md += `${role}: ${u.text}\n\n`;
    }
    if (suggestions.length) {
      md += `---\n\n## AI Suggestions Served\n\n`;
      for (const s of suggestions) {
        md += `### ${s.kind || "suggestion"}\n`;
        if (s.suggestion?.sayThis) md += `> ${s.suggestion.sayThis}\n\n`;
        else md += `${JSON.stringify(s, null, 2)}\n\n`;
      }
    }
    if (flags.length) {
      md += `---\n\n## Flags (${flags.length})\n\n`;
      for (const f of flags) {
        md += `### ${f.feedback_type || "flag"} (${f.ts_in_call_seconds ? f.ts_in_call_seconds + "s" : "N/A"})\n`;
        if (f.feedback_text) md += `${f.feedback_text}\n`;
        if (f.suggested_fix) md += `**Suggested fix:** ${f.suggested_fix}\n`;
        if (f.transcript_context) {
          const ctx = Array.isArray(f.transcript_context) ? f.transcript_context : [];
          for (const u of ctx) {
            md += `> ${u.speaker}: ${u.text}\n`;
          }
        }
        md += "\n";
      }
    }
    reply.header("Content-Type", "text/markdown; charset=utf-8");
    return md;
  });

  // ── Admin: aggregate stats ───────────────────────────────────
  app.get("/api/training/stats", async (req, reply) => {
    const pool = requireDb(reply);
    if (!pool) return;
    const stats = await pool.query(`
      SELECT
        (SELECT count(*) FROM training_sessions) AS total_sessions,
        (SELECT count(*) FROM training_flags) AS total_flags,
        (SELECT round(count(*)::numeric / NULLIF((SELECT count(*) FROM training_sessions), 0), 1)) AS flags_per_session
    `);
    const topTypes = await pool.query(`
      SELECT feedback_type, count(*) AS cnt
      FROM training_flags
      WHERE feedback_type IS NOT NULL
      GROUP BY feedback_type ORDER BY cnt DESC LIMIT 5
    `);
    return {
      ...stats.rows[0],
      top_feedback_types: topTypes.rows,
    };
  });
}
