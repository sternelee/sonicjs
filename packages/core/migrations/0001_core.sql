-- Migration 0001: Auth tables
-- auth_user, auth_session, auth_account, auth_verification + BA plugin tables + RBAC + auth support.
-- Only auth_* prefixed tables live here. All content lives in document_* tables (0002_documents.sql).

-- ── auth_user ────────────────────────────────────────────────────────────────
-- BA user model + SonicJS domain columns as BA additionalFields.
CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- SonicJS additionalFields
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  avatar TEXT,
  password_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  phone TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  email_notifications INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  invitation_token TEXT,
  invited_by TEXT,
  invited_at INTEGER,
  accepted_invitation_at INTEGER,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_user_email ON auth_user(email);
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
CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_verification_identifier ON auth_verification(identifier);

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

-- ── RBAC ─────────────────────────────────────────────────────────────────────
-- RBAC roles, verbs, and user-role assignments are document-backed (is_auth doc
-- types rbac_role / rbac_verb / rbac_user_roles — see services/rbac.ts). The
-- system roles/verbs/grants are seeded at bootstrap by RbacService.ensureSystemRbacSeed().
-- No auth_rbac_* tables.

-- ── Auth support tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_password_history_user_id ON auth_password_history(user_id);

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

-- User profiles moved to the document model: a `user_profile` document (is_auth type),
-- one per user, addressed by slug = userId. See services/document-types-seed.ts and
-- plugins/core-plugins/user-profiles/user-profile-document.ts. No auth_user_profiles table.
