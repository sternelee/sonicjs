-- Migration 044: Blog-post queryable generated columns on the documents table.
-- Supports backing the existing `blog_posts` collection with the document model (Option B): the rich
-- /admin/content collection editor keeps its UI, but create/update/list/edit go through the document
-- repository. These VIRTUAL columns let the admin filter/sort blog posts without backfill.
-- (Renumbered space: better-auth-poc claims 037-042; document repository is 043; this is 044.)

ALTER TABLE documents ADD COLUMN q_blog_difficulty TEXT AS (json_extract(data, '$.difficulty')) VIRTUAL;
ALTER TABLE documents ADD COLUMN q_blog_author     TEXT AS (json_extract(data, '$.author'))     VIRTUAL;

-- Filter/sort indexes (tenant_id + type_id lead, matching the 043 pattern). Drafts and published both
-- queried in admin, so scope to the rows that participate in lists.
CREATE INDEX IF NOT EXISTS idx_q_blog_difficulty
  ON documents(tenant_id, type_id, q_blog_difficulty) WHERE is_current_draft = 1;
CREATE INDEX IF NOT EXISTS idx_q_blog_author
  ON documents(tenant_id, type_id, q_blog_author) WHERE is_current_draft = 1;
CREATE INDEX IF NOT EXISTS idx_q_blog_difficulty_pub
  ON documents(tenant_id, type_id, q_blog_difficulty) WHERE is_published = 1;
