import type { D1Database } from '@cloudflare/workers-types'
import type {
  SecurityEvent,
  SecurityEventInsert,
  SecurityEventFilters,
  SecurityStats,
  TopIP,
  HourlyBucket,
  SecurityAuditSettings
} from '../types'
import { DEFAULT_SETTINGS } from '../types'

export class SecurityAuditService {
  constructor(
    private db: D1Database,
    private settings: SecurityAuditSettings = DEFAULT_SETTINGS
  ) {}

  async logEvent(event: SecurityEventInsert): Promise<string> {
    const id = crypto.randomUUID()
    const now = Date.now()

    await this.db.prepare(`
      INSERT INTO security_events (id, event_type, severity, user_id, email, ip_address, user_agent, country_code, request_path, request_method, details, fingerprint, blocked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      event.eventType,
      event.severity || 'info',
      event.userId || null,
      event.email || null,
      event.ipAddress || null,
      event.userAgent || null,
      event.countryCode || null,
      event.requestPath || null,
      event.requestMethod || null,
      event.details ? JSON.stringify(event.details) : null,
      event.fingerprint || null,
      event.blocked ? 1 : 0,
      now
    ).run()

    return id
  }

  async getEvents(filters: SecurityEventFilters = {}): Promise<{ events: SecurityEvent[], total: number }> {
    const conditions: string[] = []
    const params: any[] = []

    if (filters.eventType) {
      if (Array.isArray(filters.eventType)) {
        conditions.push(`event_type IN (${filters.eventType.map(() => '?').join(',')})`)
        params.push(...filters.eventType)
      } else {
        conditions.push('event_type = ?')
        params.push(filters.eventType)
      }
    }

    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        conditions.push(`severity IN (${filters.severity.map(() => '?').join(',')})`)
        params.push(...filters.severity)
      } else {
        conditions.push('severity = ?')
        params.push(filters.severity)
      }
    }

    if (filters.email) {
      conditions.push('email LIKE ?')
      params.push(`%${filters.email}%`)
    }

    if (filters.ipAddress) {
      conditions.push('ip_address LIKE ?')
      params.push(`%${filters.ipAddress}%`)
    }

    if (filters.search) {
      conditions.push('(email LIKE ? OR ip_address LIKE ? OR details LIKE ?)')
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }

    if (filters.startDate) {
      conditions.push('created_at >= ?')
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      conditions.push('created_at <= ?')
      params.push(filters.endDate)
    }

    if (filters.blocked !== undefined) {
      conditions.push('blocked = ?')
      params.push(filters.blocked ? 1 : 0)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'
    const page = filters.page || 1
    const limit = filters.limit || 50
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM security_events ${where}`
    ).bind(...params).first<{ count: number }>()
    const total = countResult?.count || 0

    // Get page of results
    const results = await this.db.prepare(
      `SELECT * FROM security_events ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all()

    const events: SecurityEvent[] = (results.results || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      email: row.email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      countryCode: row.country_code,
      requestPath: row.request_path,
      requestMethod: row.request_method,
      details: row.details ? JSON.parse(row.details) : null,
      fingerprint: row.fingerprint,
      blocked: !!row.blocked,
      createdAt: row.created_at
    }))

    return { events, total }
  }

  async getEvent(id: string): Promise<SecurityEvent | null> {
    const row = await this.db.prepare(
      'SELECT * FROM security_events WHERE id = ?'
    ).bind(id).first<any>()

    if (!row) return null

    return {
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      email: row.email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      countryCode: row.country_code,
      requestPath: row.request_path,
      requestMethod: row.request_method,
      details: row.details ? JSON.parse(row.details) : null,
      fingerprint: row.fingerprint,
      blocked: !!row.blocked,
      createdAt: row.created_at
    }
  }

  async getStats(): Promise<SecurityStats> {
    const now = Date.now()
    const h24 = now - 24 * 60 * 60 * 1000
    const h48 = now - 48 * 60 * 60 * 1000

    // Total events
    const totalResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM security_events'
    ).first<{ count: number }>()

    // Failed logins last 24h
    const failed24hResult = await this.db.prepare(
      "SELECT COUNT(*) as count FROM security_events WHERE event_type = 'login_failure' AND created_at >= ?"
    ).bind(h24).first<{ count: number }>()

    // Failed logins prior 24h (for trend)
    const failedPrior24hResult = await this.db.prepare(
      "SELECT COUNT(*) as count FROM security_events WHERE event_type = 'login_failure' AND created_at >= ? AND created_at < ?"
    ).bind(h48, h24).first<{ count: number }>()

    const failed24h = failed24hResult?.count || 0
    const failedPrior24h = failedPrior24hResult?.count || 0
    const trend = failedPrior24h > 0
      ? Math.round(((failed24h - failedPrior24h) / failedPrior24h) * 100)
      : (failed24h > 0 ? 100 : 0)

    // Active lockouts (events in last lockout window)
    const lockoutWindow = now - (this.settings.bruteForce.lockoutDurationMinutes * 60 * 1000)
    const lockoutsResult = await this.db.prepare(
      "SELECT COUNT(DISTINCT ip_address) as count FROM security_events WHERE event_type = 'account_lockout' AND created_at >= ?"
    ).bind(lockoutWindow).first<{ count: number }>()

    // Flagged IPs (IPs with more than threshold failed attempts in window)
    const windowStart = now - (this.settings.bruteForce.windowMinutes * 60 * 1000)
    const flaggedResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM (
        SELECT ip_address FROM security_events
        WHERE event_type = 'login_failure' AND created_at >= ?
        GROUP BY ip_address HAVING COUNT(*) >= ?
      )`
    ).bind(windowStart, this.settings.bruteForce.maxFailedAttemptsPerIP).first<{ count: number }>()

    // Events by type
    const typeResults = await this.db.prepare(
      'SELECT event_type, COUNT(*) as count FROM security_events WHERE created_at >= ? GROUP BY event_type'
    ).bind(h24).all()

    const eventsByType: Record<string, number> = {}
    for (const row of (typeResults.results || []) as any[]) {
      eventsByType[row.event_type] = row.count
    }

    // Events by severity
    const severityResults = await this.db.prepare(
      'SELECT severity, COUNT(*) as count FROM security_events WHERE created_at >= ? GROUP BY severity'
    ).bind(h24).all()

    const eventsBySeverity: Record<string, number> = {}
    for (const row of (severityResults.results || []) as any[]) {
      eventsBySeverity[row.severity] = row.count
    }

    return {
      totalEvents: totalResult?.count || 0,
      failedLogins24h: failed24h,
      failedLoginsTrend: trend,
      activeLockouts: lockoutsResult?.count || 0,
      flaggedIPs: flaggedResult?.count || 0,
      eventsByType,
      eventsBySeverity
    }
  }

  async getTopIPs(limit: number = 10): Promise<TopIP[]> {
    const now = Date.now()
    const h24 = now - 24 * 60 * 60 * 1000

    const results = await this.db.prepare(`
      SELECT
        ip_address,
        country_code,
        COUNT(*) as failed_attempts,
        MAX(created_at) as last_seen
      FROM security_events
      WHERE event_type = 'login_failure' AND created_at >= ?
      GROUP BY ip_address
      ORDER BY failed_attempts DESC
      LIMIT ?
    `).bind(h24, limit).all()

    // Check which IPs are locked
    const lockoutWindow = now - (this.settings.bruteForce.lockoutDurationMinutes * 60 * 1000)
    const lockoutResults = await this.db.prepare(
      "SELECT DISTINCT ip_address FROM security_events WHERE event_type = 'account_lockout' AND created_at >= ?"
    ).bind(lockoutWindow).all()

    const lockedIPs = new Set((lockoutResults.results || []).map((r: any) => r.ip_address))

    return (results.results || []).map((row: any) => ({
      ipAddress: row.ip_address,
      countryCode: row.country_code,
      failedAttempts: row.failed_attempts,
      lastSeen: row.last_seen,
      locked: lockedIPs.has(row.ip_address)
    }))
  }

  async getHourlyTrend(hours: number = 24): Promise<HourlyBucket[]> {
    const now = Date.now()
    const start = now - hours * 60 * 60 * 1000

    // Build hourly buckets
    const buckets: HourlyBucket[] = []
    for (let i = 0; i < hours; i++) {
      const bucketStart = start + i * 60 * 60 * 1000
      const date = new Date(bucketStart)
      buckets.push({
        hour: `${date.getUTCHours().toString().padStart(2, '0')}:00`,
        count: 0
      })
    }

    const results = await this.db.prepare(`
      SELECT
        CAST((created_at - ?) / 3600000 AS INTEGER) as bucket,
        COUNT(*) as count
      FROM security_events
      WHERE event_type = 'login_failure' AND created_at >= ?
      GROUP BY bucket
      ORDER BY bucket
    `).bind(start, start).all()

    for (const row of (results.results || []) as any[]) {
      const idx = row.bucket
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx]!.count = row.count
      }
    }

    return buckets
  }

  async purgeOldEvents(daysToKeep?: number): Promise<number> {
    const days = daysToKeep || this.settings.retention.daysToKeep
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    const result = await this.db.prepare(
      'DELETE FROM security_events WHERE created_at < ?'
    ).bind(cutoff).run()

    return (result.meta as any)?.changes || 0
  }

  async getRecentCriticalEvents(limit: number = 20): Promise<SecurityEvent[]> {
    const results = await this.db.prepare(
      "SELECT * FROM security_events WHERE severity = 'critical' ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all()

    return (results.results || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      email: row.email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      countryCode: row.country_code,
      requestPath: row.request_path,
      requestMethod: row.request_method,
      details: row.details ? JSON.parse(row.details) : null,
      fingerprint: row.fingerprint,
      blocked: !!row.blocked,
      createdAt: row.created_at
    }))
  }
}
