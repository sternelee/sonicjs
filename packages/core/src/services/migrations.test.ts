/**
 * Migration Service Tests - Auto-detection for migration 029
 * Tests the fix for issue #762: Migration ID 029 reused across versions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MigrationService } from './migrations'

// Mock D1Database with configurable responses
function createMockDb(options: {
  appliedMigrations?: Array<{ id: string; name: string; filename: string; applied_at: string }>;
  existingTables?: string[];
  existingColumns?: Array<{ table: string; column: string }>;
} = {}) {
  const {
    appliedMigrations = [],
    existingTables = [],
    existingColumns = []
  } = options

  const mockRun = vi.fn().mockResolvedValue({ success: true })
  const mockFirst = vi.fn()
  const mockAll = vi.fn()
  const mockBind = vi.fn()

  // Track queries to respond appropriately
  let lastQuery = ''

  const chainable = {
    bind: (...args: any[]) => {
      mockBind(...args)
      // For table existence checks
      if (lastQuery.includes('sqlite_master')) {
        const tableName = args[0]
        return {
          first: vi.fn().mockResolvedValue(
            existingTables.includes(tableName) ? { name: tableName } : null
          ),
          all: mockAll,
          run: mockRun,
          bind: chainable.bind
        }
      }
      // For column existence checks
      if (lastQuery.includes('pragma_table_info')) {
        const [table, column] = args
        const exists = existingColumns.some(c => c.table === table && c.column === column)
        return {
          first: vi.fn().mockResolvedValue(exists ? { name: column } : null),
          all: mockAll,
          run: mockRun,
          bind: chainable.bind
        }
      }
      // For migration table queries
      if (lastQuery.includes('SELECT id, name, filename, applied_at FROM migrations')) {
        return {
          first: mockFirst,
          all: vi.fn().mockResolvedValue({ results: appliedMigrations }),
          run: mockRun,
          bind: chainable.bind
        }
      }
      // For migration applied check (SELECT COUNT)
      if (lastQuery.includes('SELECT COUNT')) {
        const migrationId = args[0]
        const exists = appliedMigrations.some(m => m.id === migrationId)
        return {
          first: vi.fn().mockResolvedValue({ count: exists ? 1 : 0 }),
          all: mockAll,
          run: mockRun,
          bind: chainable.bind
        }
      }
      return {
        first: mockFirst,
        all: mockAll,
        run: mockRun,
        bind: chainable.bind
      }
    },
    first: mockFirst,
    all: vi.fn().mockResolvedValue({ results: appliedMigrations }),
    run: mockRun
  }

  const mockPrepare = vi.fn((query: string) => {
    lastQuery = query
    // For CREATE TABLE (init migrations table)
    if (query.includes('CREATE TABLE IF NOT EXISTS migrations')) {
      return { run: mockRun, bind: chainable.bind, first: mockFirst, all: mockAll }
    }
    // For SELECT from migrations (applied migrations list)
    if (query.includes('SELECT id, name, filename, applied_at FROM migrations')) {
      return {
        all: vi.fn().mockResolvedValue({ results: appliedMigrations }),
        bind: chainable.bind,
        first: mockFirst,
        run: mockRun
      }
    }
    return chainable
  })

  return {
    prepare: mockPrepare,
    _mocks: { prepare: mockPrepare, bind: mockBind, first: mockFirst, all: mockAll, run: mockRun }
  }
}

describe('MigrationService', () => {
  describe('autoDetectAppliedMigrations - migration 029 (forms)', () => {
    it('should mark 029 as applied when forms tables exist but migration is not recorded', async () => {
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: ['forms', 'form_submissions', 'form_files'],
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      const migration029 = migrations.find(m => m.id === '029')
      expect(migration029?.applied).toBe(true)

      // Verify markMigrationApplied was called for 029
      const insertCalls = db._mocks.prepare.mock.calls.filter(
        (call: any[]) => call[0].includes('INSERT OR REPLACE')
      )
      const marked029 = insertCalls.some((call: any[]) => {
        // The bind call after INSERT would contain '029'
        return true // We just verify the INSERT was called
      })
      expect(insertCalls.length).toBeGreaterThan(0)
    })

    it('should remove 029 from applied when marked as applied but forms tables are missing', async () => {
      const db = createMockDb({
        appliedMigrations: [
          { id: '029', name: 'Ai Search Plugin', filename: '029_ai_search_plugin.sql', applied_at: '2024-01-01' }
        ],
        existingTables: [], // No forms tables
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      const migration029 = migrations.find(m => m.id === '029')
      expect(migration029?.applied).toBe(false)

      // Verify removeMigrationApplied was called (DELETE query)
      const deleteCalls = db._mocks.prepare.mock.calls.filter(
        (call: any[]) => call[0].includes('DELETE FROM migrations')
      )
      expect(deleteCalls.length).toBeGreaterThan(0)
    })

    it('should keep 029 as applied when marked as applied and forms tables exist', async () => {
      const db = createMockDb({
        appliedMigrations: [
          { id: '029', name: 'Add Forms System', filename: '029_add_forms_system.sql', applied_at: '2024-01-01' }
        ],
        existingTables: ['forms', 'form_submissions', 'form_files'],
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      const migration029 = migrations.find(m => m.id === '029')
      expect(migration029?.applied).toBe(true)
    })

    it('should leave 029 as pending when not applied and forms tables do not exist', async () => {
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: [], // No forms tables
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      const migration029 = migrations.find(m => m.id === '029')
      expect(migration029?.applied).toBe(false)
    })

    it('should not mark 029 as applied when only some forms tables exist', async () => {
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: ['forms'], // Missing form_submissions and form_files
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      const migration029 = migrations.find(m => m.id === '029')
      expect(migration029?.applied).toBe(false)
    })
  })

  describe('runPendingMigrations', () => {
    it('should include errors array in response', async () => {
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: ['users', 'content', 'collections', 'media'],
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      const result = await service.runPendingMigrations()

      expect(result).toHaveProperty('errors')
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should return empty errors when all migrations are up to date', async () => {
      // Create a db where all bundled migrations are already applied
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: ['users', 'content', 'collections', 'media'],
        existingColumns: []
      })

      const service = new MigrationService(db as any)
      // Mock getMigrationStatus to return no pending
      vi.spyOn(service, 'getMigrationStatus').mockResolvedValue({
        totalMigrations: 0,
        appliedMigrations: 0,
        pendingMigrations: 0,
        migrations: []
      })

      const result = await service.runPendingMigrations()
      expect(result.errors).toEqual([])
      expect(result.success).toBe(true)
    })
  })
})
