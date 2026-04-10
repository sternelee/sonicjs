import type { D1Database } from '@cloudflare/workers-types'
import type { StripeEventRecord, StripeEventFilters, StripeEventStats } from '../types'

/**
 * Manages Stripe event log records in D1
 */
export class StripeEventService {
  constructor(private db: D1Database) {}

  async ensureTable(): Promise<void> {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        stripe_event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        object_id TEXT NOT NULL DEFAULT '',
        object_type TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL DEFAULT '{}',
        processed_at INTEGER NOT NULL DEFAULT (unixepoch()),
        status TEXT NOT NULL DEFAULT 'processed',
        error TEXT
      )
    `).run()

    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type)
    `).run()
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_events(status)
    `).run()
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events(processed_at DESC)
    `).run()
  }

  async log(event: {
    stripeEventId: string
    type: string
    objectId: string
    objectType: string
    data: Record<string, any>
    status: 'processed' | 'failed' | 'ignored'
    error?: string
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO stripe_events (stripe_event_id, type, object_id, object_type, data, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_event_id) DO UPDATE SET
        status = excluded.status,
        error = excluded.error,
        processed_at = unixepoch()
    `).bind(
      event.stripeEventId,
      event.type,
      event.objectId,
      event.objectType,
      JSON.stringify(event.data),
      event.status,
      event.error || null
    ).run()
  }

  async list(filters: StripeEventFilters = {}): Promise<{ events: StripeEventRecord[]; total: number }> {
    const where: string[] = []
    const values: any[] = []

    if (filters.type) {
      where.push('type = ?')
      values.push(filters.type)
    }
    if (filters.status) {
      where.push('status = ?')
      values.push(filters.status)
    }
    if (filters.objectId) {
      where.push('object_id = ?')
      values.push(filters.objectId)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const limit = Math.min(filters.limit || 50, 100)
    const page = filters.page || 1
    const offset = (page - 1) * limit

    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM stripe_events ${whereClause}`
    ).bind(...values).first() as { count: number }

    const results = await this.db.prepare(
      `SELECT * FROM stripe_events ${whereClause} ORDER BY processed_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, limit, offset).all()

    return {
      events: (results.results || []).map((r: any) => this.mapRow(r)),
      total: countResult?.count || 0
    }
  }

  async getStats(): Promise<StripeEventStats> {
    const result = await this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored
      FROM stripe_events
    `).first() as any

    return {
      total: result?.total || 0,
      processed: result?.processed || 0,
      failed: result?.failed || 0,
      ignored: result?.ignored || 0
    }
  }

  async getDistinctTypes(): Promise<string[]> {
    const results = await this.db.prepare(
      'SELECT DISTINCT type FROM stripe_events ORDER BY type'
    ).all()
    return (results.results || []).map((r: any) => r.type)
  }

  private mapRow(row: Record<string, any>): StripeEventRecord {
    return {
      id: row.id,
      stripeEventId: row.stripe_event_id,
      type: row.type,
      objectId: row.object_id,
      objectType: row.object_type,
      data: row.data,
      processedAt: row.processed_at,
      status: row.status,
      error: row.error || undefined
    }
  }
}
