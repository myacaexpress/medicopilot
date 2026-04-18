-- Allow training sessions without a scenario (free practice mode)
-- Run: psql "$DATABASE_URL" -f server/src/migrations/004-nullable-scenario.sql

ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_scenario_id_fkey;
ALTER TABLE training_sessions ALTER COLUMN scenario_id DROP NOT NULL;
ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES training_scenarios(id) ON DELETE SET NULL;
