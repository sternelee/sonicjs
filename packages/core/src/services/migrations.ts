import { D1Database } from '@cloudflare/workers-types'
import { bundledMigrations, getMigrationSQLById, type BundledMigration } from '../db/migrations-bundle'

export interface Migration {
  id: string
  name: string
  filename: string
  description?: string
  applied: boolean
  appliedAt?: string
  size?: number
}

export interface MigrationStatus {
  totalMigrations: number
  appliedMigrations: number
  pendingMigrations: number
  lastApplied?: string
  migrations: Migration[]
}

export class MigrationService {
  constructor(private db: D1Database) {}

  /**
   * Initialize the migrations tracking table
   */
  async initializeMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `

    await this.db.prepare(createTableQuery).run()
  }

  /**
   * Get all available migrations from the bundled migrations
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = []

    // Get applied migrations from database
    const appliedResult = await this.db.prepare(
      'SELECT id, name, filename, applied_at FROM migrations ORDER BY applied_at ASC'
    ).all()

    const appliedMigrations = new Map(
      appliedResult.results?.map((row: any) => [row.id, row]) || []
    )

    // Auto-detect applied migrations by checking if their tables exist
    await this.autoDetectAppliedMigrations(appliedMigrations)

    // Use bundled migrations as the source of truth
    for (const bundled of bundledMigrations) {
      const applied = appliedMigrations.has(bundled.id)
      const appliedData = appliedMigrations.get(bundled.id)

      migrations.push({
        id: bundled.id,
        name: bundled.name,
        filename: bundled.filename,
        description: bundled.description,
        applied,
        appliedAt: applied ? appliedData?.applied_at : undefined,
        size: bundled.sql.length
      })
    }

    return migrations
  }

  /**
   * Auto-detect applied migrations by checking if their tables exist (v3 greenfield).
   * Only the two consolidated migrations exist: 0001_core + 0002_documents.
   */
  private async autoDetectAppliedMigrations(appliedMigrations: Map<string, any>): Promise<void> {
    if (!appliedMigrations.has('0001')) {
      if (await this.checkTablesExist(['users'])) {
        appliedMigrations.set('0001', { id: '0001', applied_at: new Date().toISOString(), name: 'Core', filename: '0001_core.sql' })
        await this.markMigrationApplied('0001', 'Core', '0001_core.sql')
      }
    }
    if (!appliedMigrations.has('0002')) {
      if (await this.checkTablesExist(['documents', 'document_types'])) {
        appliedMigrations.set('0002', { id: '0002', applied_at: new Date().toISOString(), name: 'Documents', filename: '0002_documents.sql' })
        await this.markMigrationApplied('0002', 'Documents', '0002_documents.sql')
      }
    }

    // Self-heal: ensure all q_* generated columns exist on documents (idempotent).
    if (await this.checkTablesExist(['documents'])) {
      await this.ensureDocumentGeneratedColumns()
    }
  }

  /**
   * Ensure the `documents` table exposes every queryable VIRTUAL generated column (D45). Safe to run on
   * every bootstrap: existing columns are skipped, missing ones are added, and the unavoidable race of a
   * concurrent add surfaces as a swallowed "duplicate column name" error.
   */
  private async ensureDocumentGeneratedColumns(): Promise<void> {
    // (column name, full ADD COLUMN body) — kept in sync with migrations 043 + 044.
    const columns: Array<[string, string]> = [
      ['q_faq_category',    "q_faq_category TEXT AS (json_extract(data, '$.category')) VIRTUAL"],
      ['q_faq_sort_order',  "q_faq_sort_order INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL"],
      ['q_tst_rating',      "q_tst_rating INTEGER AS (json_extract(data, '$.rating')) VIRTUAL"],
      ['q_tst_company',     "q_tst_company TEXT AS (json_extract(data, '$.authorCompany')) VIRTUAL"],
      ['q_tst_sort_order',  "q_tst_sort_order INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL"],
      ['q_msg_review',      "q_msg_review TEXT AS (json_extract(data, '$.reviewStatus')) VIRTUAL"],
      ['q_msg_email',       "q_msg_email TEXT AS (json_extract(data, '$.email')) VIRTUAL"],
      ['q_media_mime',      "q_media_mime TEXT AS (json_extract(data, '$.mimeType')) VIRTUAL"],
      ['q_media_folder',    "q_media_folder TEXT AS (json_extract(data, '$.folder')) VIRTUAL"],
      ['q_media_size',      "q_media_size INTEGER AS (json_extract(data, '$.size')) VIRTUAL"],
      ['q_blog_difficulty', "q_blog_difficulty TEXT AS (json_extract(data, '$.difficulty')) VIRTUAL"],
      ['q_blog_author',     "q_blog_author TEXT AS (json_extract(data, '$.author')) VIRTUAL"],
      // email_log document type (plugin-system/email-reconciliation)
      ['q_email_status',   "q_email_status TEXT AS (json_extract(data, '$.status')) VIRTUAL"],
      ['q_email_provider', "q_email_provider TEXT AS (json_extract(data, '$.provider')) VIRTUAL"],
      ['q_email_flow',     "q_email_flow TEXT AS (json_extract(data, '$.flow')) VIRTUAL"],
      ['q_email_to',       "q_email_to TEXT AS (json_extract(data, '$.toEmail')) VIRTUAL"],
    ]
    // Note: pragma_table_info does NOT list VIRTUAL generated columns — use table_xinfo, which does.
    let existing = new Set<string>()
    try {
      const info = await this.db.prepare("SELECT name FROM pragma_table_xinfo('documents')").all()
      existing = new Set((info?.results ?? []).map((r: any) => r.name))
    } catch {
      // table_xinfo unavailable — fall back to attempting every ALTER (duplicate errors are swallowed).
    }
    for (const [name, body] of columns) {
      if (existing.has(name)) continue
      try {
        await this.db.prepare(`ALTER TABLE documents ADD COLUMN ${body}`).run()
        console.log(`[Migration] D45: added missing documents.${name}`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!msg.includes('duplicate column name')) {
          console.error(`[Migration] D45: failed to add documents.${name}:`, msg)
        }
      }
    }
  }

  /**
   * Check if specific tables exist in the database
   */
  private async checkTablesExist(tableNames: string[]): Promise<boolean> {
    try {
      for (const tableName of tableNames) {
        const result = await this.db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).bind(tableName).first()

        if (!result) {
          return false
        }
      }
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Check if a specific column exists in a table
   */
  private async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const result = await this.db.prepare(
        `SELECT * FROM pragma_table_info(?) WHERE name = ?`
      ).bind(tableName, columnName).first()

      return !!result
    } catch (error) {
      return false
    }
  }

  /**
   * Get migration status summary
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    await this.initializeMigrationsTable()

    const migrations = await this.getAvailableMigrations()
    const appliedMigrations = migrations.filter(m => m.applied)
    const pendingMigrations = migrations.filter(m => !m.applied)

    const lastApplied = appliedMigrations.length > 0
      ? appliedMigrations[appliedMigrations.length - 1]?.appliedAt
      : undefined

    return {
      totalMigrations: migrations.length,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations: pendingMigrations.length,
      lastApplied,
      migrations
    }
  }

  /**
   * Mark a migration as applied
   */
  async markMigrationApplied(migrationId: string, name: string, filename: string): Promise<void> {
    await this.initializeMigrationsTable()

    await this.db.prepare(
      'INSERT OR REPLACE INTO migrations (id, name, filename, applied_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(migrationId, name, filename).run()
  }

  /**
   * Remove a migration from the applied list (so it can be re-run)
   */
  async removeMigrationApplied(migrationId: string): Promise<void> {
    await this.initializeMigrationsTable()

    await this.db.prepare(
      'DELETE FROM migrations WHERE id = ?'
    ).bind(migrationId).run()
  }

  /**
   * Check if a specific migration has been applied
   */
  async isMigrationApplied(migrationId: string): Promise<boolean> {
    await this.initializeMigrationsTable()

    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM migrations WHERE id = ?'
    ).bind(migrationId).first()

    return (result?.count as number) > 0
  }

  /**
   * Get the last applied migration
   */
  async getLastAppliedMigration(): Promise<Migration | null> {
    await this.initializeMigrationsTable()

    const result = await this.db.prepare(
      'SELECT id, name, filename, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 1'
    ).first()

    if (!result) return null

    return {
      id: result.id as string,
      name: result.name as string,
      filename: result.filename as string,
      applied: true,
      appliedAt: result.applied_at as string
    }
  }

  /**
   * Run pending migrations
   */
  async runPendingMigrations(): Promise<{ success: boolean; message: string; applied: string[]; errors: string[] }> {
    await this.initializeMigrationsTable()

    const status = await this.getMigrationStatus()
    const pendingMigrations = status.migrations.filter(m => !m.applied)

    if (pendingMigrations.length === 0) {
      return {
        success: true,
        message: 'All migrations are up to date',
        applied: [],
        errors: []
      }
    }

    // Actually execute the migration files
    const applied: string[] = []
    const errors: string[] = []

    for (const migration of pendingMigrations) {
      try {
        console.log(`[Migration] Applying ${migration.id}: ${migration.name}`)
        await this.applyMigration(migration)
        await this.markMigrationApplied(migration.id, migration.name, migration.filename)
        applied.push(migration.id)
        console.log(`[Migration] Successfully applied ${migration.id}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[Migration] Failed to apply migration ${migration.id}:`, errorMessage)
        errors.push(`${migration.id}: ${errorMessage}`)
        // Continue with other migrations instead of stopping on first failure
        // This allows independent migrations to still be applied
      }
    }

    if (errors.length > 0 && applied.length === 0) {
      return {
        success: false,
        message: `Failed to apply migrations: ${errors.join('; ')}`,
        applied,
        errors
      }
    }

    return {
      success: true,
      message: applied.length > 0
        ? `Applied ${applied.length} migration(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
        : 'No migrations applied',
      applied,
      errors
    }
  }

  /**
   * Apply a specific migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    // Get the actual migration SQL from the bundle
    const migrationSQL = getMigrationSQLById(migration.id)

    if (migrationSQL === null) {
      throw new Error(`Migration SQL not found for ${migration.id}`)
    }

    if (migrationSQL.trim() === '') {
      console.log(`[Migration] Skipping empty migration ${migration.id}`)
      return
    }

    // Split SQL into individual statements, handling triggers properly
    const statements = this.splitSQLStatements(migrationSQL)

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.db.prepare(statement).run()
        } catch (error) {
          // Check if it's a "already exists" type error and skip it
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('already exists') ||
              errorMessage.includes('duplicate column name') ||
              errorMessage.includes('UNIQUE constraint failed')) {
            console.log(`[Migration] Skipping (already exists): ${statement.substring(0, 50)}...`)
            continue
          }
          console.error(`[Migration] Error executing statement: ${statement.substring(0, 100)}...`)
          throw error
        }
      }
    }
  }

  /**
   * Split SQL into statements, handling CREATE TRIGGER properly
   */
  private splitSQLStatements(sql: string): string[] {
    const statements: string[] = []
    let current = ''
    let inTrigger = false

    const lines = sql.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip comments and empty lines
      if (trimmed.startsWith('--') || trimmed.length === 0) {
        continue
      }

      // Check if we're entering a trigger
      if (trimmed.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true
      }

      current += line + '\n'

      // Check if we're exiting a trigger
      if (inTrigger && trimmed.toUpperCase() === 'END;') {
        statements.push(current.trim())
        current = ''
        inTrigger = false
      }
      // Check for regular statement end (not in trigger)
      else if (!inTrigger && trimmed.endsWith(';')) {
        statements.push(current.trim())
        current = ''
      }
    }

    // Add any remaining statement
    if (current.trim()) {
      statements.push(current.trim())
    }

    return statements.filter(s => s.length > 0)
  }

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    // Basic table existence checks
    const requiredTables = [
      'users', 'documents', 'document_types'
    ]

    for (const table of requiredTables) {
      try {
        await this.db.prepare(`SELECT COUNT(*) FROM ${table} LIMIT 1`).first()
      } catch (error) {
        issues.push(`Missing table: ${table}`)
      }
    }

    // Check for managed column in collections
    const hasManagedColumn = await this.checkColumnExists('collections', 'managed')
    if (!hasManagedColumn) {
      issues.push('Missing column: collections.managed')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}
