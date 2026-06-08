-- Migration 0001: Core Baseline (v3 greenfield)
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
