-- Training session event tables: transcripts + AI suggestions
-- Run: psql "$DATABASE_URL" -f server/src/migrations/003-session-events.sql

CREATE TABLE IF NOT EXISTS training_transcripts (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES training_sessions(id) ON DELETE CASCADE,
  speaker TEXT,
  text TEXT,
  timestamp_ms INT,
  is_final BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_ai_suggestions (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES training_sessions(id) ON DELETE CASCADE,
  say_this TEXT,
  trigger_info JSONB,
  call_stage TEXT,
  follow_up_questions JSONB,
  timestamp_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_transcripts_session_ts ON training_transcripts(session_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_training_ai_suggestions_session_ts ON training_ai_suggestions(session_id, timestamp_ms);
