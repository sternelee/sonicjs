-- Migration 0001: Core Baseline (v3 greenfield + Better Auth)
-- All auth-owned tables carry the auth_ prefix.
-- BA tables: auth_user, auth_session, auth_account, auth_verification.
-- RBAC tables: auth_rbac_*.
-- BA plugin tables: auth_two_factor, auth_organization, auth_member, auth_invitation, auth_team.
-- Legacy auth tables (magic_links, otp_codes, oauth_accounts) removed — BA covers them.

-- ── auth_user ────────────────────────────────────────────────────────────────
-- Better Auth user model. Carries SonicJS domain columns (role, username, etc.)
-- as BA additionalFields. The invited_by self-reference is deferred to avoid a
-- forward-reference; SQLite enforces it through the index, not the FK.
CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY,
  -- BA required
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- SonicJS domain (BA additionalFields)
  username TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  avatar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  phone TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  email_notifications INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  -- invitation flow
  invitation_token TEXT,
  invited_by TEXT,             -- self-ref to auth_user(id), not enforced as FK to avoid fwd-ref
  invited_at INTEGER,
  accepted_invitation_at INTEGER,
  -- account lockout (BA signIn.before hook checks these)
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_user_email ON auth_user(email);
CREATE INDEX IF NOT EXISTS idx_auth_user_username ON auth_user(username);
CREATE INDEX IF NOT EXISTS idx_auth_user_role ON auth_user(role);
CREATE INDEX IF NOT EXISTS idx_auth_user_invitation_token ON auth_user(invitation_token);
CREATE INDEX IF NOT EXISTS idx_auth_user_locked_until ON auth_user(locked_until) WHERE locked_until IS NOT NULL;

-- ── auth_session ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_session_user_id ON auth_session(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_session_token ON auth_session(token);
CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON auth_session(expires_at);

-- ── auth_account ─────────────────────────────────────────────────────────────
-- Credential + OAuth provider rows. BA owns this table.
CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  id_token TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_account_user_id ON auth_account(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_account_provider ON auth_account(provider_id, account_id);

-- ── auth_verification ────────────────────────────────────────────────────────
-- Covers email verification, password reset, magic-link tokens, OTP codes.
-- Replaces the legacy magic_links and otp_codes tables.
CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_verification_identifier ON auth_verification(identifier);

-- ── auth_password_history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_password_history_user_id ON auth_password_history(user_id);

-- ── auth_api_tokens ──────────────────────────────────────────────────────────
-- Legacy API token table; superseded by BA apiKey plugin in a future phase.
CREATE TABLE IF NOT EXISTS auth_api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES auth_user(id),
  permissions TEXT NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_api_tokens_user ON auth_api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_api_tokens_token ON auth_api_tokens(token);

-- ── auth_user_profiles ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_auth_user_profiles_user_id ON auth_user_profiles(user_id);

CREATE TRIGGER IF NOT EXISTS auth_user_profiles_updated_at
AFTER UPDATE ON auth_user_profiles BEGIN
  UPDATE auth_user_profiles SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- ── RBAC ─────────────────────────────────────────────────────────────────────
-- Dynamic roles/verbs/grants. auth_rbac_user_roles ties users to roles.

CREATE TABLE IF NOT EXISTS auth_rbac_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS auth_rbac_verbs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100
);

-- One row per (role, resource, verb) grant; wildcards supported.
CREATE TABLE IF NOT EXISTS auth_rbac_role_grants (
  role_id TEXT NOT NULL REFERENCES auth_rbac_roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  verb TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'any',
  PRIMARY KEY (role_id, resource, verb)
);

CREATE TABLE IF NOT EXISTS auth_rbac_user_roles (
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES auth_rbac_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Seed system roles
INSERT OR IGNORE INTO auth_rbac_roles (id, name, display_name, description, is_system) VALUES
  ('role-admin',  'admin',  'Administrator', 'Full access to everything',                   1),
  ('role-editor', 'editor', 'Editor',        'Manage content and media across collections', 1),
  ('role-author', 'author', 'Author',        'Create and edit own content',                 1),
  ('role-viewer', 'viewer', 'Viewer',        'Read-only access',                            1);

-- Seed system verbs
INSERT OR IGNORE INTO auth_rbac_verbs (id, name, description, is_system, sort_order) VALUES
  ('verb-access', 'access', 'Enter or use a portal/resource', 1,  5),
  ('verb-read',   'read',   'View a resource',                1, 10),
  ('verb-create', 'create', 'Create a resource',              1, 20),
  ('verb-update', 'update', 'Edit a resource',                1, 30),
  ('verb-delete', 'delete', 'Remove a resource',              1, 40),
  ('verb-manage', 'manage', 'Full control (implies all verbs)',1, 50);

-- Default grants
INSERT OR IGNORE INTO auth_rbac_role_grants (role_id, resource, verb) VALUES
  ('role-admin', '*',           'manage'),
  ('role-admin', 'portal',      'access'),
  ('role-admin', 'rbac',        'manage'),
  ('role-admin', 'collections', 'manage'),
  ('role-admin', 'email',       'manage'),
  ('role-admin', 'users',       'manage');

INSERT OR IGNORE INTO auth_rbac_role_grants (role_id, resource, verb) VALUES
  ('role-editor', 'content',      'manage'),
  ('role-editor', 'media',        'manage'),
  ('role-editor', 'collection:*', 'read'),
  ('role-editor', 'collection:*', 'create'),
  ('role-editor', 'collection:*', 'update'),
  ('role-editor', 'collection:*', 'delete'),
  ('role-editor', 'settings',     'read');

INSERT OR IGNORE INTO auth_rbac_role_grants (role_id, resource, verb) VALUES
  ('role-author', 'content',      'read'),
  ('role-author', 'content',      'create'),
  ('role-author', 'content',      'update'),
  ('role-author', 'media',        'read'),
  ('role-author', 'media',        'create'),
  ('role-author', 'collection:*', 'read');

INSERT OR IGNORE INTO auth_rbac_role_grants (role_id, resource, verb) VALUES
  ('role-viewer', 'content',      'read'),
  ('role-viewer', 'media',        'read'),
  ('role-viewer', 'collection:*', 'read');

-- ── BA plugin tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_two_factor (
  id           TEXT PRIMARY KEY,
  secret       TEXT NOT NULL,
  backup_codes TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  verified     INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_two_factor_user_id ON auth_two_factor(user_id);

CREATE TABLE IF NOT EXISTS auth_organization (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  logo       TEXT,
  metadata   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_member (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES auth_organization(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES auth_user(id)         ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member',
  email           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_member_org  ON auth_member(organization_id);
CREATE INDEX IF NOT EXISTS idx_auth_member_user ON auth_member(user_id);

CREATE TABLE IF NOT EXISTS auth_invitation (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES auth_organization(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member',
  status          TEXT NOT NULL DEFAULT 'pending',
  expires_at      INTEGER NOT NULL,
  inviter_id      TEXT REFERENCES auth_user(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_invitation_org   ON auth_invitation(organization_id);
CREATE INDEX IF NOT EXISTS idx_auth_invitation_email ON auth_invitation(email);

CREATE TABLE IF NOT EXISTS auth_team (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES auth_organization(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ── Plugin system ─────────────────────────────────────────────────────────────
-- Kept as dedicated tables per document-model-poc-plan.md §"Keep dedicated tables"
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'core',
    category TEXT NOT NULL DEFAULT 'core',
    icon TEXT,
    status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
    is_core BOOLEAN DEFAULT FALSE,
    settings JSON,
    permissions JSON,
    dependencies JSON,
    download_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    installed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    activated_at INTEGER,
    last_updated INTEGER NOT NULL DEFAULT (unixepoch()),
    error_message TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  hook_name TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);

CREATE TABLE IF NOT EXISTS plugin_routes (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  middleware TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_plugin_routes_plugin ON plugin_routes(plugin_id);

CREATE TABLE IF NOT EXISTS plugin_assets (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  asset_type TEXT NOT NULL,
  asset_path TEXT NOT NULL,
  load_order INTEGER NOT NULL DEFAULT 100,
  load_location TEXT NOT NULL DEFAULT 'footer',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_plugin_assets_plugin ON plugin_assets(plugin_id);

CREATE TABLE IF NOT EXISTS plugin_activity_log (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  action TEXT NOT NULL,
  user_id TEXT,
  details TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_plugin_activity_plugin ON plugin_activity_log(plugin_id);

-- ── Content ───────────────────────────────────────────────────────────────────
-- Runs alongside the document model POC (document-model-poc-plan.md R12).
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
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_active);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  author_id TEXT NOT NULL REFERENCES auth_user(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_content_collection ON content(collection_id);
CREATE INDEX IF NOT EXISTS idx_content_author ON content(author_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content(id),
  version INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  author_id TEXT NOT NULL REFERENCES auth_user(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);

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
  uploaded_by TEXT NOT NULL REFERENCES auth_user(id),
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
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(deleted_at);

CREATE TABLE IF NOT EXISTS workflow_history (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content(id),
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id),
  comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_workflow_history_content ON workflow_history(content_id);

-- ── System logging ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  user_id TEXT REFERENCES auth_user(id),
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
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);

CREATE TABLE IF NOT EXISTS log_config (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL DEFAULT 'info',
  retention INTEGER NOT NULL DEFAULT 30,
  max_size INTEGER DEFAULT 10000,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO log_config (id, category, enabled, level, retention, max_size, created_at, updated_at) VALUES
  ('auth-config',     'auth',     1, 'info',  30,  10000, unixepoch() * 1000, unixepoch() * 1000),
  ('api-config',      'api',      1, 'info',   7,  50000, unixepoch() * 1000, unixepoch() * 1000),
  ('workflow-config', 'workflow', 1, 'info',  30,  10000, unixepoch() * 1000, unixepoch() * 1000),
  ('plugin-config',   'plugin',   1, 'info',  30,  10000, unixepoch() * 1000, unixepoch() * 1000),
  ('media-config',    'media',    1, 'info',  30,  10000, unixepoch() * 1000, unixepoch() * 1000),
  ('system-config',   'system',   1, 'warn',  30,  10000, unixepoch() * 1000, unixepoch() * 1000),
  ('security-config', 'security', 1, 'warn',  90,  20000, unixepoch() * 1000, unixepoch() * 1000),
  ('error-config',    'error',    1, 'error', 90,  20000, unixepoch() * 1000, unixepoch() * 1000);

-- ── Forms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  formio_schema TEXT NOT NULL,
  settings TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_public INTEGER NOT NULL DEFAULT 1,
  managed INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  color TEXT,
  tags TEXT,
  submission_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES auth_user(id),
  updated_by TEXT REFERENCES auth_user(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submission_number INTEGER,
  user_id TEXT REFERENCES auth_user(id),
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  reviewed_by TEXT REFERENCES auth_user(id),
  reviewed_at INTEGER,
  review_notes TEXT,
  is_spam INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  content_id TEXT REFERENCES content(id),
  submitted_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS form_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);
