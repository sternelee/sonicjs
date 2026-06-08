'use strict';

// src/db/migrations-bundle.ts
var bundledMigrations = [
  {
    id: "0001",
    name: "Core",
    filename: "0001_core.sql",
    description: "Migration 0001: Core",
    sql: "-- Migration 0001: Core Baseline (v3 greenfield)\n-- Consolidated from the v2 migration set. Contains auth plus core platform tables\n-- that still run alongside the document-model POC.\nCREATE TABLE IF NOT EXISTS users (\n  id TEXT PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  username TEXT NOT NULL UNIQUE,\n  first_name TEXT NOT NULL,\n  last_name TEXT NOT NULL,\n  password_hash TEXT,\n  role TEXT NOT NULL DEFAULT 'viewer',\n  avatar TEXT,\n  is_active INTEGER NOT NULL DEFAULT 1,\n  last_login_at INTEGER,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL,\n  phone TEXT,\n  bio TEXT,\n  avatar_url TEXT,\n  timezone TEXT DEFAULT 'UTC',\n  language TEXT DEFAULT 'en',\n  email_notifications INTEGER DEFAULT 1,\n  theme TEXT DEFAULT 'dark',\n  two_factor_enabled INTEGER DEFAULT 0,\n  two_factor_secret TEXT,\n  password_reset_token TEXT,\n  password_reset_expires INTEGER,\n  email_verified INTEGER DEFAULT 0,\n  email_verification_token TEXT,\n  invitation_token TEXT,\n  invited_by TEXT REFERENCES users(id),\n  invited_at INTEGER,\n  accepted_invitation_at INTEGER\n);\n\nCREATE INDEX IF NOT EXISTS idx_users_email ON users(email);\n\nCREATE INDEX IF NOT EXISTS idx_users_username ON users(username);\n\nCREATE INDEX IF NOT EXISTS idx_users_role ON users(role);\n\nCREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);\n\nCREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);\n\nCREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);\n\nCREATE TABLE IF NOT EXISTS api_tokens (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  token TEXT NOT NULL UNIQUE,\n  user_id TEXT NOT NULL REFERENCES users(id),\n  permissions TEXT NOT NULL,\n  expires_at INTEGER,\n  last_used_at INTEGER,\n  created_at INTEGER NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);\n\nCREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);\n\nCREATE TABLE IF NOT EXISTS password_history (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  password_hash TEXT NOT NULL,\n  created_at INTEGER NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);\n\nCREATE TABLE IF NOT EXISTS magic_links (\n  id TEXT PRIMARY KEY,\n  user_email TEXT NOT NULL,\n  token TEXT NOT NULL UNIQUE,\n  expires_at INTEGER NOT NULL,\n  used INTEGER DEFAULT 0,\n  used_at INTEGER,\n  ip_address TEXT,\n  user_agent TEXT,\n  created_at INTEGER NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);\n\nCREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(user_email);\n\nCREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);\n\nCREATE TABLE IF NOT EXISTS otp_codes (\n  id TEXT PRIMARY KEY,\n  user_email TEXT NOT NULL,\n  code TEXT NOT NULL,\n  expires_at INTEGER NOT NULL,\n  used INTEGER DEFAULT 0,\n  used_at INTEGER,\n  ip_address TEXT,\n  user_agent TEXT,\n  attempts INTEGER DEFAULT 0,\n  created_at INTEGER NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_codes(user_email, code);\n\nCREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);\n\nCREATE INDEX IF NOT EXISTS idx_otp_used ON otp_codes(used);\n\nCREATE TABLE IF NOT EXISTS user_profiles (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,\n  display_name TEXT,\n  bio TEXT,\n  company TEXT,\n  job_title TEXT,\n  website TEXT,\n  location TEXT,\n  date_of_birth INTEGER,\n  data TEXT DEFAULT '{}',\n  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),\n  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)\n);\n\nCREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);\n\nCREATE TRIGGER IF NOT EXISTS user_profiles_updated_at\nAFTER\nUPDATE\n  ON user_profiles BEGIN\nUPDATE\n  user_profiles\nSET\n  updated_at = strftime('%s', 'now') * 1000\nWHERE\n  id = NEW.id;\n\nEND;"
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
//# sourceMappingURL=chunk-WSTTYBUZ.cjs.map
//# sourceMappingURL=chunk-WSTTYBUZ.cjs.map