import { Hono } from 'hono'
import type { Bindings, Variables } from '../app'
import { DocumentRepository } from '../services/document-repository'
import { DocumentTypeRegistry } from '../services/document-type-registry'

const apiDocumentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── List published documents ─────────────────────────────────────────────────
// GET /api/documents?type=faq&locale=en&limit=20&cursor_updated_at=…&cursor_id=…
// Scalar filters: ?filter[category]=general  (maps to q_faq_category)
// Facet filters:  ?facet[tags]=homepage
apiDocumentsRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB
    const tenantId = 'default'
    const now = Math.floor(Date.now() / 1000)

    const typeId = c.req.query('type') ?? ''
    const locale = c.req.query('locale') ?? 'default'
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 200)
    const cursorUpdatedAt = c.req.query('cursor_updated_at') ? parseInt(c.req.query('cursor_updated_at')!, 10) : undefined
    const cursorId = c.req.query('cursor_id') ?? undefined

    if (!typeId) {
      return c.json({ error: 'type query parameter is required' }, 400)
    }

    // Resolve queryable fields for scalar/facet filter mapping.
    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType || !docType.isActive) {
      return c.json({ error: 'Unknown document type' }, 400)
    }

    const queryableFields = docType.queryableFields ?? []
    const scalarColumns = new Map(
      queryableFields.filter(f => f.kind === 'scalar' && f.column).map(f => [f.name, f.column!])
    )
    const facetFields = new Set(queryableFields.filter(f => f.kind === 'facet').map(f => f.name))

    // Parse filter params
    const rawQuery = new URLSearchParams(c.req.url.split('?')[1] ?? '')
    const scalarFilters: Array<{ column: string; value: string }> = []
    const facetFilter: { field: string; value: string } | null = (() => {
      for (const [key, value] of rawQuery.entries()) {
        const m = key.match(/^facet\[(.+)\]$/)
        const fieldName = m?.[1]
        if (fieldName && facetFields.has(fieldName)) return { field: fieldName, value }
      }
      return null
    })()

    for (const [key, value] of rawQuery.entries()) {
      const m = key.match(/^filter\[(.+)\]$/)
      const fieldName = m?.[1]
      if (fieldName && scalarColumns.has(fieldName)) {
        scalarFilters.push({ column: scalarColumns.get(fieldName)!, value })
      }
    }

    // Sort column: default updated_at/id cursor; allow queryable scalar sorts.
    const sortField = c.req.query('sort') ?? 'updated_at'
    const sortColumn = sortField !== 'updated_at' ? scalarColumns.get(sortField) ?? null : null
    const sortDir = (c.req.query('dir') ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    // Build query
    const useFacetJoin = !!facetFilter

    const params: (string | number)[] = [tenantId, typeId, now, now]
    let sql: string

    if (useFacetJoin) {
      sql = `SELECT d.* FROM documents d
             JOIN document_facets f ON f.document_id = d.id
             WHERE d.tenant_id = ? AND d.type_id = ? AND d.is_published = 1 AND d.deleted_at IS NULL
               AND (d.scheduled_at IS NULL OR d.scheduled_at <= ?)
               AND (d.expires_at IS NULL OR d.expires_at > ?)
               AND f.field_name = ? AND f.value_text = ?`
      params.push(facetFilter!.field, facetFilter!.value)
    } else {
      sql = `SELECT * FROM documents
             WHERE tenant_id = ? AND type_id = ? AND is_published = 1 AND deleted_at IS NULL
               AND (scheduled_at IS NULL OR scheduled_at <= ?)
               AND (expires_at IS NULL OR expires_at > ?)`
    }

    if (locale !== 'default') {
      sql += ` AND ${useFacetJoin ? 'd.' : ''}locale = ?`
      params.push(locale)
    }

    for (const sf of scalarFilters) {
      sql += ` AND ${useFacetJoin ? 'd.' : ''}${sf.column} = ?`
      params.push(sf.value)
    }

    if (cursorUpdatedAt !== undefined && cursorId) {
      const prefix = useFacetJoin ? 'd.' : ''
      sql += ` AND (${prefix}updated_at < ? OR (${prefix}updated_at = ? AND ${prefix}id < ?))`
      params.push(cursorUpdatedAt, cursorUpdatedAt, cursorId)
    }

    const orderPrefix = useFacetJoin ? 'd.' : ''
    if (sortColumn) {
      sql += ` ORDER BY ${orderPrefix}${sortColumn} ${sortDir}, ${orderPrefix}id ${sortDir} LIMIT ?`
    } else {
      sql += ` ORDER BY ${orderPrefix}updated_at ${sortDir}, ${orderPrefix}id ${sortDir} LIMIT ?`
    }
    params.push(limit)

    const result = await db.prepare(sql).bind(...params).all()
    const rows = (result.results ?? []) as any[]

    const items = rows.map(r => ({
      id: r.id,
      rootId: r.root_id,
      typeId: r.type_id,
      title: r.title,
      slug: r.slug,
      path: r.path,
      locale: r.locale,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
      data: JSON.parse(r.data ?? '{}'),
    }))

    const lastItem = items[items.length - 1]
    const nextCursor = items.length === limit && lastItem
      ? { cursor_updated_at: lastItem.updatedAt, cursor_id: lastItem.id }
      : null

    return c.json({ data: items, pagination: { limit, nextCursor } })
  } catch (error) {
    console.error('Error listing published documents:', error)
    return c.json({ error: 'Failed to list documents' }, 500)
  }
})

// ─── Get published document by root ID ──────────────────────────────────────
apiDocumentsRoutes.get('/root/:rootId', async (c) => {
  try {
    const db = c.env.DB
    const tenantId = 'default'
    const now = Math.floor(Date.now() / 1000)
    const { rootId } = c.req.param()

    const row = await db.prepare(
      `SELECT * FROM documents
       WHERE root_id = ? AND tenant_id = ? AND is_published = 1 AND deleted_at IS NULL
         AND (scheduled_at IS NULL OR scheduled_at <= ?)
         AND (expires_at IS NULL OR expires_at > ?)`,
    ).bind(rootId, tenantId, now, now).first() as any

    if (!row) return c.json({ error: 'Not found' }, 404)

    return c.json({
      id: row.id, rootId: row.root_id, typeId: row.type_id,
      title: row.title, slug: row.slug, path: row.path, locale: row.locale,
      publishedAt: row.published_at, updatedAt: row.updated_at,
      data: JSON.parse(row.data ?? '{}'),
    })
  } catch (error) {
    console.error('Error getting document by root:', error)
    return c.json({ error: 'Failed to get document' }, 500)
  }
})

// ─── Get published document by ID ────────────────────────────────────────────
apiDocumentsRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB
    const tenantId = 'default'
    const now = Math.floor(Date.now() / 1000)
    const { id } = c.req.param()

    const row = await db.prepare(
      `SELECT * FROM documents
       WHERE id = ? AND tenant_id = ? AND is_published = 1 AND deleted_at IS NULL
         AND (scheduled_at IS NULL OR scheduled_at <= ?)
         AND (expires_at IS NULL OR expires_at > ?)`,
    ).bind(id, tenantId, now, now).first() as any

    if (!row) return c.json({ error: 'Not found' }, 404)

    return c.json({
      id: row.id, rootId: row.root_id, typeId: row.type_id,
      title: row.title, slug: row.slug, path: row.path, locale: row.locale,
      publishedAt: row.published_at, updatedAt: row.updated_at,
      data: JSON.parse(row.data ?? '{}'),
    })
  } catch (error) {
    console.error('Error getting document:', error)
    return c.json({ error: 'Failed to get document' }, 500)
  }
})

export { apiDocumentsRoutes }
export default apiDocumentsRoutes
