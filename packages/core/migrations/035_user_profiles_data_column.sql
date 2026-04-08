-- Migration 035: Add data column to user_profiles
-- Stores custom profile fields as JSON (used by user-profiles plugin)
--
-- The data column was missing from migration 032 when the user-profiles plugin
-- was added in PR #747. The ALTER TABLE migration was placed in the wrong
-- directory (src/db/migrations/) so it was never bundled or executed.
-- This caused the user edit page to crash with a 500 error because the route
-- queries SELECT ... data FROM user_profiles.
--
-- Migration 032 has been updated to include the column for fresh installs.
-- This migration handles existing databases that already ran 032 without it.

-- SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- but re-adding an existing column is a no-op error that we catch at the
-- application level. The migration runner skips already-applied migrations
-- by ID, so this only runs on databases missing the column.
ALTER TABLE user_profiles ADD COLUMN data TEXT DEFAULT '{}';
