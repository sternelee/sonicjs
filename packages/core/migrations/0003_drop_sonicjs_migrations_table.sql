-- Remove SonicJS's legacy runtime migration tracker.
-- Cloudflare D1's d1_migrations table is the canonical migration state.

DROP TABLE IF EXISTS migrations;
