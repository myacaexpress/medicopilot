-- Allow free practice sessions with no scenario
-- Run: psql $DATABASE_URL -f server/src/migrations/004-nullable-scenario.sql

ALTER TABLE training_sessions ALTER COLUMN scenario_id DROP NOT NULL;
