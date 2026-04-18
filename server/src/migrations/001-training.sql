-- Training platform schema
-- Run against Neon: psql $DATABASE_URL -f server/src/migrations/001-training.sql

CREATE TABLE IF NOT EXISTS training_scenarios (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  persona_name  TEXT NOT NULL,
  persona_age   INTEGER,
  persona_state TEXT NOT NULL DEFAULT 'FL',
  situation     TEXT NOT NULL,
  opening_lines TEXT[] NOT NULL DEFAULT '{}',
  carrier_prefs TEXT,
  objections    TEXT[] NOT NULL DEFAULT '{}',
  medications   TEXT[] NOT NULL DEFAULT '{}',
  success_criteria TEXT[] NOT NULL DEFAULT '{}',
  hidden_curveball TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id              SERIAL PRIMARY KEY,
  scenario_id     TEXT NOT NULL REFERENCES training_scenarios(id),
  tester_name     TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER,
  rating          INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text   TEXT,
  master_prompt_version TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_flags (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES training_sessions(id),
  timestamp_ms INTEGER NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  flag_type   TEXT NOT NULL DEFAULT 'general',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_scenario ON training_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_flags_session ON training_flags(session_id);
