/**
 * Migration Service Tests
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
  describe('consolidated greenfield migrations', () => {
    it('exposes only 0001 core and 0002 document-only migrations', async () => {
      const db = createMockDb({
        appliedMigrations: []
      })

      const service = new MigrationService(db as any)
      const migrations = await service.getAvailableMigrations()

      expect(migrations.map(m => m.id)).toEqual(['0001', '0002'])
      expect(migrations.find(m => m.id === '029')).toBeUndefined()
    })
  })

  describe('runPendingMigrations', () => {
    it('should include errors array in response', async () => {
      const db = createMockDb({
        appliedMigrations: [],
        existingTables: ['users', 'documents', 'document_types'],
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
        existingTables: ['users', 'documents', 'document_types'],
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
