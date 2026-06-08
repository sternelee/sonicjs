'use strict';

// src/db/migrations-bundle.ts
var bundledMigrations = [
  {
    id: "0001",
    name: "Core",
    filename: "0001_core.sql",
    description: "Migration 0001: Core",
    sql: `-- Migration 0001: Core Baseline (v3 greenfield)
-- Consolidated from the v2 migration set. Contains auth plus core platform tables
-- that still run alongside the document-model POC.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  avatar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  email_notifications INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  password_reset_token TEXT,
  password_reset_expires INTEGER,
  email_verified INTEGER DEFAULT 0,
  email_verification_token TEXT,
  invitation_token TEXT,
  invited_by TEXT REFERENCES users(id),
  invited_at INTEGER,
  accepted_invitation_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  permissions TEXT NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);

CREATE TABLE IF NOT EXISTS password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  used_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(user_email);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  used_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  attempts INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_codes(user_email, code);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_used ON otp_codes(used);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  company TEXT,
  job_title TEXT,
  website TEXT,
  location TEXT,
  date_of_birth INTEGER,
  data TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TRIGGER IF NOT EXISTS user_profiles_updated_at
  AFTER UPDATE ON user_profiles
BEGIN
  UPDATE user_profiles SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- Collection registry. Collections remain as schema/type metadata for the admin editor
-- and for legacy content-backed paths that still run alongside the document POC.
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  schema TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  managed INTEGER NOT NULL DEFAULT 0,
  source_type TEXT DEFAULT 'user',
  source_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_active);
CREATE INDEX IF NOT EXISTS idx_collections_source ON collections(source_type, source_id);
INSERT OR IGNORE INTO collections (id, name, display_name, description, schema, is_active, created_at, updated_at)
VALUES
  ('blog_posts', 'blog_posts', 'Blog Posts', 'Blog post content type', '{}', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('pages', 'pages', 'Pages', 'Static page content type', '{}', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('news', 'news', 'News', 'News article content type', '{}', 1, unixepoch() * 1000, unixepoch() * 1000);

-- Legacy dynamic field metadata fallback. Code-defined collections normally use
-- collections.schema, but several admin paths still fall back to this table.
CREATE TABLE IF NOT EXISTS content_fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id),
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_options TEXT,
  field_order INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 0,
  is_searchable INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(collection_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_content_fields_collection ON content_fields(collection_id);
CREATE INDEX IF NOT EXISTS idx_content_fields_order ON content_fields(collection_id, field_order);

-- Media is still read by the live media library while uploads are mirrored into media_asset
-- documents. Keep this table until the media read flip is complete.
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  folder TEXT NOT NULL DEFAULT 'uploads',
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt TEXT,
  caption TEXT,
  tags TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at INTEGER NOT NULL,
  updated_at INTEGER,
  published_at INTEGER,
  scheduled_at INTEGER,
  archived_at INTEGER,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_media_folder ON media(folder);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_at ON media(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_r2_key ON media(r2_key);

-- Legacy content storage. The document-model POC runs alongside these paths until the
-- decommission checklist in docs/ai/plans/document-model-poc-plan.md is complete.
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  scheduled_publish_at INTEGER,
  scheduled_unpublish_at INTEGER,
  review_status TEXT DEFAULT 'none',
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  review_notes TEXT,
  meta_title TEXT,
  meta_description TEXT,
  featured_image_id TEXT REFERENCES media(id),
  content_type TEXT DEFAULT 'standard',
  workflow_state_id TEXT DEFAULT 'draft',
  embargo_until INTEGER,
  expires_at INTEGER,
  version_number INTEGER DEFAULT 1,
  is_auto_saved INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_content_collection ON content(collection_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
CREATE INDEX IF NOT EXISTS idx_content_author ON content(author_id);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at);
CREATE INDEX IF NOT EXISTS idx_content_published_at ON content(published_at);
CREATE INDEX IF NOT EXISTS idx_content_scheduled_publish ON content(scheduled_publish_at);
CREATE INDEX IF NOT EXISTS idx_content_review_status ON content(review_status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_workflow_state ON content(workflow_state_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_collection_slug ON content(collection_id, slug);

-- Union shape for legacy admin content versioning and workflow-plugin versioning.
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  content_id TEXT NOT NULL REFERENCES content(id),
  version INTEGER,
  data TEXT,
  author_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  version_number INTEGER,
  title TEXT,
  content TEXT,
  fields TEXT,
  user_id TEXT REFERENCES users(id),
  change_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_version ON content_versions(content_id, version);
CREATE INDEX IF NOT EXISTS idx_content_versions_version_number ON content_versions(content_id, version_number);

-- Union shape for legacy status history and workflow-plugin state history.
CREATE TABLE IF NOT EXISTS workflow_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  content_id TEXT NOT NULL,
  action TEXT,
  from_status TEXT,
  to_status TEXT,
  workflow_id TEXT,
  from_state_id TEXT,
  to_state_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_content ON workflow_history(content_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_user ON workflow_history(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_created ON workflow_history(created_at);

-- Plugin registry/state. Plugin-owned feature tables are not global migrations anymore,
-- but plugin activation/menu/settings still depend on this registry.
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  is_core INTEGER DEFAULT 0,
  settings TEXT,
  permissions TEXT,
  dependencies TEXT,
  download_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  installed_at INTEGER NOT NULL,
  activated_at INTEGER,
  last_updated INTEGER NOT NULL,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  hook_name TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  priority INTEGER DEFAULT 10,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(plugin_id, hook_name, handler_name)
);

CREATE TABLE IF NOT EXISTS plugin_routes (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  middleware TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(plugin_id, path, method)
);

CREATE TABLE IF NOT EXISTS plugin_assets (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('css', 'js', 'image', 'font')),
  asset_path TEXT NOT NULL,
  load_order INTEGER DEFAULT 100,
  load_location TEXT DEFAULT 'footer' CHECK (load_location IN ('header', 'footer')),
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS plugin_activity_log (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id TEXT,
  details TEXT,
  timestamp INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_routes_plugin ON plugin_routes(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_assets_plugin ON plugin_assets(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_activity_plugin ON plugin_activity_log(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_activity_timestamp ON plugin_activity_log(timestamp);

-- Application settings used by auth/settings middleware.
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_category_key ON settings(category, key);

INSERT OR IGNORE INTO settings (id, category, key, value, created_at, updated_at)
VALUES
  (lower(hex(randomblob(16))), 'general', 'siteName', '"SonicJS AI"', unixepoch() * 1000, unixepoch() * 1000),
  (lower(hex(randomblob(16))), 'general', 'siteDescription', '"A modern headless CMS powered by AI"', unixepoch() * 1000, unixepoch() * 1000),
  (lower(hex(randomblob(16))), 'general', 'timezone', '"UTC"', unixepoch() * 1000, unixepoch() * 1000),
  (lower(hex(randomblob(16))), 'general', 'language', '"en"', unixepoch() * 1000, unixepoch() * 1000),
  (lower(hex(randomblob(16))), 'general', 'maintenanceMode', 'false', unixepoch() * 1000, unixepoch() * 1000);

-- Operational logging/audit tables that are still mounted in the core app.
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  category TEXT NOT NULL CHECK (category IN ('auth', 'api', 'workflow', 'plugin', 'media', 'system', 'security', 'error')),
  message TEXT NOT NULL,
  data TEXT,
  user_id TEXT REFERENCES users(id),
  session_id TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  method TEXT,
  url TEXT,
  status_code INTEGER,
  duration INTEGER,
  stack_trace TEXT,
  tags TEXT,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS log_config (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE CHECK (category IN ('auth', 'api', 'workflow', 'plugin', 'media', 'system', 'security', 'error')),
  enabled INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_size_mb INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_status_code ON system_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);

INSERT OR IGNORE INTO log_config (id, category, enabled, level, retention_days, max_size_mb) VALUES
('log-config-auth', 'auth', 1, 'info', 90, 50),
('log-config-api', 'api', 1, 'info', 30, 100),
('log-config-workflow', 'workflow', 1, 'info', 60, 50),
('log-config-plugin', 'plugin', 1, 'warn', 30, 25),
('log-config-media', 'media', 1, 'info', 30, 50),
('log-config-system', 'system', 1, 'info', 90, 100),
('log-config-security', 'security', 1, 'warn', 180, 100),
('log-config-error', 'error', 1, 'error', 90, 200);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'user-activity',
  properties TEXT,
  user_id TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON analytics_events(category);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events(path);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  user_id TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  request_path TEXT,
  request_method TEXT,
  details TEXT,
  fingerprint TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_fingerprint ON security_events(fingerprint);
`
  },
  {
    id: "0002",
    name: "Documents",
    filename: "0002_documents.sql",
    description: "Migration 0002: Documents",
    sql: "-- Migration 0002: Document Schema (v3 greenfield)\n-- Contains only the new document data model tables, generated columns, and indexes.\n\n-- Document type registry\nCREATE TABLE IF NOT EXISTS document_types (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL UNIQUE,\n  display_name TEXT NOT NULL,\n  description TEXT,\n  schema TEXT NOT NULL DEFAULT '{}',\n  queryable_fields TEXT NOT NULL DEFAULT '[]',\n  settings TEXT NOT NULL DEFAULT '{}',\n  plugin_id TEXT,\n  source TEXT NOT NULL DEFAULT 'code' CHECK (source IN ('code', 'plugin', 'system')),\n  schema_version INTEGER NOT NULL DEFAULT 1,\n  is_system INTEGER NOT NULL DEFAULT 0,\n  is_active INTEGER NOT NULL DEFAULT 1,\n  created_at INTEGER NOT NULL DEFAULT (unixepoch()),\n  updated_at INTEGER NOT NULL DEFAULT (unixepoch())\n);\n\nCREATE INDEX IF NOT EXISTS idx_document_types_plugin ON document_types(plugin_id);\nCREATE INDEX IF NOT EXISTS idx_document_types_active ON document_types(is_active);\n\n-- Documents: canonical document rows and historical versions.\nCREATE TABLE IF NOT EXISTS documents (\n  id TEXT PRIMARY KEY,\n  root_id TEXT NOT NULL,\n  type_id TEXT NOT NULL REFERENCES document_types(id),\n  type_version INTEGER NOT NULL DEFAULT 1,\n\n  version_of_id TEXT REFERENCES documents(id),\n  version_number INTEGER NOT NULL DEFAULT 1,\n\n  is_current_draft INTEGER NOT NULL DEFAULT 1,\n  is_published INTEGER NOT NULL DEFAULT 0,\n  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),\n\n  parent_root_id TEXT NOT NULL DEFAULT '',\n  slug TEXT,\n  path TEXT,\n  title TEXT,\n  zone TEXT,\n  sort_order INTEGER NOT NULL DEFAULT 0,\n  visible INTEGER NOT NULL DEFAULT 1,\n\n  published_at INTEGER,\n  scheduled_at INTEGER,\n  expires_at INTEGER,\n  deleted_at INTEGER,\n\n  tenant_id TEXT NOT NULL DEFAULT 'default',\n  locale TEXT NOT NULL DEFAULT 'default',\n  translation_group_id TEXT NOT NULL DEFAULT '',\n\n  data TEXT NOT NULL DEFAULT '{}',\n  metadata TEXT NOT NULL DEFAULT '{}',\n\n  owner_id TEXT,\n  created_by TEXT,\n  updated_by TEXT,\n  created_at INTEGER NOT NULL DEFAULT (unixepoch()),\n  updated_at INTEGER NOT NULL DEFAULT (unixepoch())\n);\n\n-- Queryable scalar fields as VIRTUAL generated columns (no write cost, no drift).\n\n-- FAQ\nALTER TABLE documents ADD COLUMN q_faq_category   TEXT    AS (json_extract(data, '$.category'))  VIRTUAL;\nALTER TABLE documents ADD COLUMN q_faq_sort_order  INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL;\n\n-- Testimonial\nALTER TABLE documents ADD COLUMN q_tst_rating      INTEGER AS (json_extract(data, '$.rating'))        VIRTUAL;\nALTER TABLE documents ADD COLUMN q_tst_company     TEXT    AS (json_extract(data, '$.authorCompany')) VIRTUAL;\nALTER TABLE documents ADD COLUMN q_tst_sort_order  INTEGER AS (json_extract(data, '$.sortOrder'))     VIRTUAL;\n\n-- Contact Message\nALTER TABLE documents ADD COLUMN q_msg_review      TEXT    AS (json_extract(data, '$.reviewStatus')) VIRTUAL;\nALTER TABLE documents ADD COLUMN q_msg_email       TEXT    AS (json_extract(data, '$.email'))        VIRTUAL;\n\n-- Media Asset\nALTER TABLE documents ADD COLUMN q_media_mime      TEXT    AS (json_extract(data, '$.mimeType')) VIRTUAL;\nALTER TABLE documents ADD COLUMN q_media_folder    TEXT    AS (json_extract(data, '$.folder'))   VIRTUAL;\nALTER TABLE documents ADD COLUMN q_media_size      INTEGER AS (json_extract(data, '$.size'))     VIRTUAL;\n\n-- Blog Post\nALTER TABLE documents ADD COLUMN q_blog_difficulty TEXT AS (json_extract(data, '$.difficulty')) VIRTUAL;\nALTER TABLE documents ADD COLUMN q_blog_author     TEXT AS (json_extract(data, '$.author'))     VIRTUAL;\n\n-- Revision chain\nCREATE INDEX IF NOT EXISTS idx_documents_root ON documents(root_id, version_number DESC);\n\n-- List / lifecycle\nCREATE INDEX IF NOT EXISTS idx_documents_published ON documents(tenant_id, type_id, locale, is_published)\n  WHERE is_published = 1 AND deleted_at IS NULL;\nCREATE INDEX IF NOT EXISTS idx_documents_drafts ON documents(tenant_id, type_id, status, is_current_draft)\n  WHERE is_current_draft = 1;\nCREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(tenant_id, parent_root_id, sort_order, is_published);\nCREATE INDEX IF NOT EXISTS idx_documents_path ON documents(tenant_id, path);\nCREATE INDEX IF NOT EXISTS idx_documents_translation ON documents(translation_group_id, locale);\nCREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted_at);\nCREATE INDEX IF NOT EXISTS idx_documents_scheduled ON documents(scheduled_at) WHERE scheduled_at IS NOT NULL;\nCREATE INDEX IF NOT EXISTS idx_documents_expires ON documents(expires_at) WHERE expires_at IS NOT NULL;\n\n-- Stable keyset/cursor pagination for published lists\nCREATE INDEX IF NOT EXISTS idx_documents_published_cursor\n  ON documents(tenant_id, type_id, updated_at DESC, id DESC)\n  WHERE is_published = 1 AND deleted_at IS NULL;\n\n-- Generated-column filter indexes\nCREATE INDEX IF NOT EXISTS idx_q_faq_category ON documents(tenant_id, type_id, q_faq_category, q_faq_sort_order) WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_tst_rating   ON documents(tenant_id, type_id, q_tst_rating, q_tst_sort_order)   WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_tst_company  ON documents(tenant_id, type_id, q_tst_company, q_tst_sort_order)  WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_media_mime   ON documents(tenant_id, type_id, q_media_mime)   WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_media_folder ON documents(tenant_id, type_id, q_media_folder) WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_media_size   ON documents(tenant_id, type_id, q_media_size)   WHERE is_published = 1;\nCREATE INDEX IF NOT EXISTS idx_q_msg_review   ON documents(tenant_id, type_id, q_msg_review) WHERE is_current_draft = 1;\nCREATE INDEX IF NOT EXISTS idx_q_msg_email    ON documents(tenant_id, type_id, q_msg_email)  WHERE is_current_draft = 1;\nCREATE INDEX IF NOT EXISTS idx_q_blog_difficulty ON documents(tenant_id, type_id, q_blog_difficulty) WHERE is_current_draft = 1;\nCREATE INDEX IF NOT EXISTS idx_q_blog_author ON documents(tenant_id, type_id, q_blog_author) WHERE is_current_draft = 1;\nCREATE INDEX IF NOT EXISTS idx_q_blog_difficulty_pub ON documents(tenant_id, type_id, q_blog_difficulty) WHERE is_published = 1;\n\n-- Partial unique indexes: the hard concurrency guarantees for draft/publish invariants.\nCREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_current_draft\n  ON documents(root_id) WHERE is_current_draft = 1;\nCREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_published\n  ON documents(root_id) WHERE is_published = 1;\nCREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_version\n  ON documents(root_id, version_number);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_slug\n  ON documents(tenant_id, locale, type_id, parent_root_id, slug)\n  WHERE is_current_draft = 1 AND deleted_at IS NULL AND slug IS NOT NULL;\nCREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_translation_per_locale\n  ON documents(tenant_id, translation_group_id, locale)\n  WHERE is_current_draft = 1 AND translation_group_id <> '';\n\n-- Document references: typed document-to-document edges.\nCREATE TABLE IF NOT EXISTS document_references (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  from_root_id TEXT NOT NULL,\n  from_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  field_name TEXT NOT NULL,\n  ordinal INTEGER NOT NULL DEFAULT 0,\n  to_root_id TEXT NOT NULL,\n  ref_strength TEXT NOT NULL DEFAULT 'weak' CHECK (ref_strength IN ('strong', 'weak')),\n  created_at INTEGER NOT NULL DEFAULT (unixepoch())\n);\n\nCREATE INDEX IF NOT EXISTS idx_docref_to   ON document_references(tenant_id, to_root_id);\nCREATE INDEX IF NOT EXISTS idx_docref_from ON document_references(from_document_id);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_docref_unique\n  ON document_references(from_document_id, field_name, ordinal);\n\n-- Document facets: indexed rows for multi-valued scalar fields (e.g. tags arrays).\nCREATE TABLE IF NOT EXISTS document_facets (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  root_id TEXT NOT NULL,\n  type_id TEXT NOT NULL,\n  field_name TEXT NOT NULL,\n  ordinal INTEGER NOT NULL DEFAULT 0,\n  value_text TEXT,\n  value_number REAL,\n  created_at INTEGER NOT NULL DEFAULT (unixepoch())\n);\n\nCREATE INDEX IF NOT EXISTS idx_facets_lookup ON document_facets(tenant_id, type_id, field_name, value_text);\nCREATE INDEX IF NOT EXISTS idx_facets_doc    ON document_facets(document_id);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_facets_unique\n  ON document_facets(document_id, field_name, ordinal);\n\n-- Document permissions: per-document ACL overrides.\nCREATE TABLE IF NOT EXISTS document_permissions (\n  id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  root_id TEXT NOT NULL,\n  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'role', 'group', 'public', 'token')),\n  principal_id TEXT NOT NULL,\n  permission TEXT NOT NULL CHECK (permission IN ('read', 'create', 'update', 'delete', 'publish', 'manage')),\n  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),\n  inherited INTEGER NOT NULL DEFAULT 0,\n  created_at INTEGER NOT NULL DEFAULT (unixepoch()),\n  created_by TEXT\n);\n\nCREATE INDEX IF NOT EXISTS idx_document_permissions_root ON document_permissions(tenant_id, root_id);\nCREATE INDEX IF NOT EXISTS idx_document_permissions_principal\n  ON document_permissions(tenant_id, principal_type, principal_id, permission);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_document_permissions_unique\n  ON document_permissions(root_id, principal_type, principal_id, permission);\n"
  }
];
var migrationsByIdMap = new Map(
  bundledMigrations.map((m) => [m.id, m])
);
function getMigrationSQLById(id) {
  return migrationsByIdMap.get(id)?.sql ?? null;
}

// src/services/migrations.ts
var MigrationService = class {
  constructor(db) {
    this.db = db;
  }
  /**
   * Initialize the migrations tracking table
   */
  async initializeMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `;
    await this.db.prepare(createTableQuery).run();
  }
  /**
   * Get all available migrations from the bundled migrations
   */
  async getAvailableMigrations() {
    const migrations = [];
    const appliedResult = await this.db.prepare(
      "SELECT id, name, filename, applied_at FROM migrations ORDER BY applied_at ASC"
    ).all();
    const appliedMigrations = new Map(
      appliedResult.results?.map((row) => [row.id, row]) || []
    );
    await this.autoDetectAppliedMigrations(appliedMigrations);
    for (const bundled of bundledMigrations) {
      const applied = appliedMigrations.has(bundled.id);
      const appliedData = appliedMigrations.get(bundled.id);
      migrations.push({
        id: bundled.id,
        name: bundled.name,
        filename: bundled.filename,
        description: bundled.description,
        applied,
        appliedAt: applied ? appliedData?.applied_at : void 0,
        size: bundled.sql.length
      });
    }
    return migrations;
  }
  /**
   * Auto-detect applied migrations by checking if their tables exist (v3 greenfield).
   * Only the two consolidated migrations exist: 0001_core + 0002_documents.
   */
  async autoDetectAppliedMigrations(appliedMigrations) {
    if (!appliedMigrations.has("0001")) {
      if (await this.checkTablesExist(["users"])) {
        appliedMigrations.set("0001", { id: "0001", applied_at: (/* @__PURE__ */ new Date()).toISOString(), name: "Core", filename: "0001_core.sql" });
        await this.markMigrationApplied("0001", "Core", "0001_core.sql");
      }
    }
    if (!appliedMigrations.has("0002")) {
      if (await this.checkTablesExist(["documents", "document_types"])) {
        appliedMigrations.set("0002", { id: "0002", applied_at: (/* @__PURE__ */ new Date()).toISOString(), name: "Documents", filename: "0002_documents.sql" });
        await this.markMigrationApplied("0002", "Documents", "0002_documents.sql");
      }
    }
    if (await this.checkTablesExist(["documents"])) {
      await this.ensureDocumentGeneratedColumns();
    }
  }
  /**
   * Ensure the `documents` table exposes every queryable VIRTUAL generated column (D45). Safe to run on
   * every bootstrap: existing columns are skipped, missing ones are added, and the unavoidable race of a
   * concurrent add surfaces as a swallowed "duplicate column name" error.
   */
  async ensureDocumentGeneratedColumns() {
    const columns = [
      ["q_faq_category", "q_faq_category TEXT AS (json_extract(data, '$.category')) VIRTUAL"],
      ["q_faq_sort_order", "q_faq_sort_order INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL"],
      ["q_tst_rating", "q_tst_rating INTEGER AS (json_extract(data, '$.rating')) VIRTUAL"],
      ["q_tst_company", "q_tst_company TEXT AS (json_extract(data, '$.authorCompany')) VIRTUAL"],
      ["q_tst_sort_order", "q_tst_sort_order INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL"],
      ["q_msg_review", "q_msg_review TEXT AS (json_extract(data, '$.reviewStatus')) VIRTUAL"],
      ["q_msg_email", "q_msg_email TEXT AS (json_extract(data, '$.email')) VIRTUAL"],
      ["q_media_mime", "q_media_mime TEXT AS (json_extract(data, '$.mimeType')) VIRTUAL"],
      ["q_media_folder", "q_media_folder TEXT AS (json_extract(data, '$.folder')) VIRTUAL"],
      ["q_media_size", "q_media_size INTEGER AS (json_extract(data, '$.size')) VIRTUAL"],
      ["q_blog_difficulty", "q_blog_difficulty TEXT AS (json_extract(data, '$.difficulty')) VIRTUAL"],
      ["q_blog_author", "q_blog_author TEXT AS (json_extract(data, '$.author')) VIRTUAL"]
    ];
    let existing = /* @__PURE__ */ new Set();
    try {
      const info = await this.db.prepare("SELECT name FROM pragma_table_xinfo('documents')").all();
      existing = new Set((info?.results ?? []).map((r) => r.name));
    } catch {
    }
    for (const [name, body] of columns) {
      if (existing.has(name)) continue;
      try {
        await this.db.prepare(`ALTER TABLE documents ADD COLUMN ${body}`).run();
        console.log(`[Migration] D45: added missing documents.${name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes("duplicate column name")) {
          console.error(`[Migration] D45: failed to add documents.${name}:`, msg);
        }
      }
    }
  }
  /**
   * Check if specific tables exist in the database
   */
  async checkTablesExist(tableNames) {
    try {
      for (const tableName of tableNames) {
        const result = await this.db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).bind(tableName).first();
        if (!result) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }
  /**
   * Check if a specific column exists in a table
   */
  async checkColumnExists(tableName, columnName) {
    try {
      const result = await this.db.prepare(
        `SELECT * FROM pragma_table_info(?) WHERE name = ?`
      ).bind(tableName, columnName).first();
      return !!result;
    } catch (error) {
      return false;
    }
  }
  /**
   * Get migration status summary
   */
  async getMigrationStatus() {
    await this.initializeMigrationsTable();
    const migrations = await this.getAvailableMigrations();
    const appliedMigrations = migrations.filter((m) => m.applied);
    const pendingMigrations = migrations.filter((m) => !m.applied);
    const lastApplied = appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1]?.appliedAt : void 0;
    return {
      totalMigrations: migrations.length,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations: pendingMigrations.length,
      lastApplied,
      migrations
    };
  }
  /**
   * Mark a migration as applied
   */
  async markMigrationApplied(migrationId, name, filename) {
    await this.initializeMigrationsTable();
    await this.db.prepare(
      "INSERT OR REPLACE INTO migrations (id, name, filename, applied_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    ).bind(migrationId, name, filename).run();
  }
  /**
   * Remove a migration from the applied list (so it can be re-run)
   */
  async removeMigrationApplied(migrationId) {
    await this.initializeMigrationsTable();
    await this.db.prepare(
      "DELETE FROM migrations WHERE id = ?"
    ).bind(migrationId).run();
  }
  /**
   * Check if a specific migration has been applied
   */
  async isMigrationApplied(migrationId) {
    await this.initializeMigrationsTable();
    const result = await this.db.prepare(
      "SELECT COUNT(*) as count FROM migrations WHERE id = ?"
    ).bind(migrationId).first();
    return result?.count > 0;
  }
  /**
   * Get the last applied migration
   */
  async getLastAppliedMigration() {
    await this.initializeMigrationsTable();
    const result = await this.db.prepare(
      "SELECT id, name, filename, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 1"
    ).first();
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      filename: result.filename,
      applied: true,
      appliedAt: result.applied_at
    };
  }
  /**
   * Run pending migrations
   */
  async runPendingMigrations() {
    await this.initializeMigrationsTable();
    const status = await this.getMigrationStatus();
    const pendingMigrations = status.migrations.filter((m) => !m.applied);
    if (pendingMigrations.length === 0) {
      return {
        success: true,
        message: "All migrations are up to date",
        applied: [],
        errors: []
      };
    }
    const applied = [];
    const errors = [];
    for (const migration of pendingMigrations) {
      try {
        console.log(`[Migration] Applying ${migration.id}: ${migration.name}`);
        await this.applyMigration(migration);
        await this.markMigrationApplied(migration.id, migration.name, migration.filename);
        applied.push(migration.id);
        console.log(`[Migration] Successfully applied ${migration.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Migration] Failed to apply migration ${migration.id}:`, errorMessage);
        errors.push(`${migration.id}: ${errorMessage}`);
      }
    }
    if (errors.length > 0 && applied.length === 0) {
      return {
        success: false,
        message: `Failed to apply migrations: ${errors.join("; ")}`,
        applied,
        errors
      };
    }
    return {
      success: true,
      message: applied.length > 0 ? `Applied ${applied.length} migration(s)${errors.length > 0 ? ` (${errors.length} failed)` : ""}` : "No migrations applied",
      applied,
      errors
    };
  }
  /**
   * Apply a specific migration
   */
  async applyMigration(migration) {
    const migrationSQL = getMigrationSQLById(migration.id);
    if (migrationSQL === null) {
      throw new Error(`Migration SQL not found for ${migration.id}`);
    }
    if (migrationSQL.trim() === "") {
      console.log(`[Migration] Skipping empty migration ${migration.id}`);
      return;
    }
    const statements = this.splitSQLStatements(migrationSQL);
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.db.prepare(statement).run();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("already exists") || errorMessage.includes("duplicate column name") || errorMessage.includes("UNIQUE constraint failed")) {
            console.log(`[Migration] Skipping (already exists): ${statement.substring(0, 50)}...`);
            continue;
          }
          console.error(`[Migration] Error executing statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }
  }
  /**
   * Split SQL into statements, handling CREATE TRIGGER properly
   */
  splitSQLStatements(sql) {
    const statements = [];
    let current = "";
    let inTrigger = false;
    const lines = sql.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("--") || trimmed.length === 0) {
        continue;
      }
      if (trimmed.toUpperCase().includes("CREATE TRIGGER")) {
        inTrigger = true;
      }
      current += line + "\n";
      if (inTrigger && trimmed.toUpperCase() === "END;") {
        statements.push(current.trim());
        current = "";
        inTrigger = false;
      } else if (!inTrigger && trimmed.endsWith(";")) {
        statements.push(current.trim());
        current = "";
      }
    }
    if (current.trim()) {
      statements.push(current.trim());
    }
    return statements.filter((s) => s.length > 0);
  }
  /**
   * Validate database schema
   */
  async validateSchema() {
    const issues = [];
    const requiredTables = [
      "users",
      "documents",
      "document_types"
    ];
    for (const table of requiredTables) {
      try {
        await this.db.prepare(`SELECT COUNT(*) FROM ${table} LIMIT 1`).first();
      } catch (error) {
        issues.push(`Missing table: ${table}`);
      }
    }
    const hasManagedColumn = await this.checkColumnExists("collections", "managed");
    if (!hasManagedColumn) {
      issues.push("Missing column: collections.managed");
    }
    return {
      valid: issues.length === 0,
      issues
    };
  }
};

exports.MigrationService = MigrationService;
//# sourceMappingURL=chunk-NL5E7FBB.cjs.map
//# sourceMappingURL=chunk-NL5E7FBB.cjs.map