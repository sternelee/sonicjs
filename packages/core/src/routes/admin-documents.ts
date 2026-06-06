import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Bindings, Variables } from '../app'
import { z } from 'zod'
import { DocumentsService } from '../services/documents'
import { DocumentTypeRegistry } from '../services/document-type-registry'
import { DocumentRepository } from '../services/document-repository'
import { createDocumentSchema, updateDocumentSchema } from '../schemas/document'

const adminDocumentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminDocumentsRoutes.use('*', requireAuth())
// NOTE (D19): the AUTHORITATIVE admin gate is the global app.use('/admin/*', requireRole(adminRoles))
// in app.ts, where adminRoles defaults to ['admin']. That guard runs BEFORE this one, so for editors
// to reach these routes the host app must set config.adminAccessRoles to include 'editor'. This
// per-router list is the intended document-route role set; keep it in sync with that config.
adminDocumentsRoutes.use('*', requireRole(['admin', 'editor']))

// ─── List document types ──────────────────────────────────────────────────────
adminDocumentsRoutes.get('/types', async (c) => {
  try {
    const registry = new DocumentTypeRegistry(c.env.DB)
    const types = await registry.findAll()
    return c.json({ data: types })
  } catch (error) {
    console.error('Error listing document types:', error)
    return c.json({ error: 'Failed to list document types' }, 500)
  }
})

// NOTE: HTML UI for document types has been removed.
// Document content is now managed through /admin/content (see admin-content.ts).
// The /admin/content list includes document types in its models dropdown,
// and CRUD routes live at /admin/content/documents/:typeId/...

// ─── Placeholder: redirect /ui to content list ────────────────────────────────
adminDocumentsRoutes.get('/ui', (c) => c.redirect('/admin/content'))
adminDocumentsRoutes.get('/ui/:typeId', (c) => c.redirect(`/admin/content?model=doc:${c.req.param('typeId')}`))
adminDocumentsRoutes.get('/ui/:typeId/:rootId/edit', (c) => {
  const { typeId, rootId } = c.req.param()
  return c.redirect(`/admin/content/documents/${typeId}/${rootId}/edit`)
})

// ═══════════════════════════════════════════════════════════════════════════════
// (removed UI routes section)
// ═══════════════════════════════════════════════════════════════════════════════


// ─── List documents (admin — drafts + published) ──────────────────────────────
// GET /admin/documents?type=faq&status=draft&locale=en&limit=50&cursor_updated_at=…&cursor_id=…
// Scalar filters: ?filter[category]=general
// Facet filters:  ?facet[tags]=homepage
adminDocumentsRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB
    const user = c.get('user') as { userId: string; email: string; role: string }
    const tenantId = 'default'

    const typeId = c.req.query('type') ?? ''
    const status = (c.req.query('status') ?? 'draft') as 'draft' | 'published' | 'all'
    const locale = c.req.query('locale') ?? 'default'
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 200)
    const cursorUpdatedAt = c.req.query('cursor_updated_at') ? parseInt(c.req.query('cursor_updated_at')!, 10) : undefined
    const cursorId = c.req.query('cursor_id') ?? undefined

    if (!typeId) {
      return c.json({ error: 'type query parameter is required' }, 400)
    }

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

    const sortField = c.req.query('sort') ?? 'updated_at'
    const sortColumn = sortField !== 'updated_at' ? scalarColumns.get(sortField) ?? null : null
    const sortDir = (c.req.query('dir') ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const useFacetJoin = !!facetFilter
    const params: (string | number)[] = [tenantId, typeId]

    let sql: string
    if (useFacetJoin) {
      sql = `SELECT d.* FROM documents d
             JOIN document_facets f ON f.document_id = d.id
             WHERE d.tenant_id = ? AND d.type_id = ? AND d.deleted_at IS NULL
               AND f.field_name = ? AND f.value_text = ?`
      params.push(facetFilter!.field, facetFilter!.value)

      if (status === 'draft') {
        sql += ' AND d.is_current_draft = 1'
      } else if (status === 'published') {
        sql += ' AND d.is_published = 1'
      } else {
        sql += ' AND (d.is_current_draft = 1 OR d.is_published = 1)'
      }
    } else {
      sql = `SELECT * FROM documents WHERE tenant_id = ? AND type_id = ? AND deleted_at IS NULL`
      if (status === 'draft') {
        sql += ' AND is_current_draft = 1'
      } else if (status === 'published') {
        sql += ' AND is_published = 1'
      } else {
        sql += ' AND (is_current_draft = 1 OR is_published = 1)'
      }
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
      status: r.status,
      isCurrentDraft: r.is_current_draft === 1,
      isPublished: r.is_published === 1,
      versionNumber: r.version_number,
      locale: r.locale,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
      data: JSON.parse(r.data ?? '{}'),
    }))

    const lastItem = items[items.length - 1]
    const nextCursor = items.length === limit && lastItem
      ? { cursor_updated_at: lastItem.updatedAt, cursor_id: lastItem.id }
      : null

    return c.json({ data: items, pagination: { limit, nextCursor } })
  } catch (error) {
    console.error('Error listing documents:', error)
    return c.json({ error: 'Failed to list documents' }, 500)
  }
})

// ─── Get single document by ID (current draft) ───────────────────────────────
adminDocumentsRoutes.get('/:id', async (c) => {
  try {
    const repo = new DocumentRepository(c.env.DB, 'default')
    const doc = await repo.getById(c.req.param('id'))
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: doc })
  } catch (error) {
    console.error('Error getting document:', error)
    return c.json({ error: 'Failed to get document' }, 500)
  }
})

// ─── Get version history ──────────────────────────────────────────────────────
adminDocumentsRoutes.get('/:rootId/versions', async (c) => {
  try {
    const repo = new DocumentRepository(c.env.DB, 'default')
    const versions = await repo.getVersionHistory(c.req.param('rootId'))
    return c.json({ data: versions })
  } catch (error) {
    console.error('Error getting version history:', error)
    return c.json({ error: 'Failed to get versions' }, 500)
  }
})

// ─── Create document ──────────────────────────────────────────────────────────
adminDocumentsRoutes.post('/', async (c) => {
  try {
    const contentType = c.req.header('Content-Type')
    if (!contentType?.includes('application/json')) {
      return c.json({ error: 'Content-Type must be application/json' }, 400)
    }

    let body: unknown
    try { body = await c.req.json() } catch {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }

    const validation = createDocumentSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: 'Validation failed', details: validation.error.issues }, 400)
    }

    const input = validation.data
    const db = c.env.DB
    const user = c.get('user') as { userId: string; email: string; role: string }

    // Validate document type exists and validate data against its schema.
    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(input.typeId)
    if (!docType || !docType.isActive) {
      return c.json({ error: 'Unknown document type' }, 400)
    }

    // TODO(doc-model, D6): validate input.data against the registered type's Zod schema.
    // Deferred for the POC — types register with an `anyObject` passthrough and z.ZodSchema cannot
    // survive the JSON round-trip in document_types.schema. When implemented, keep a module-level
    // Map<typeId, z.ZodSchema> populated by bootstrapDocumentTypes and safeParse here, returning
    // { error: 'Validation failed', details: result.error.issues } with 400. (Removed the previous
    // broken no-op that referenced a nonexistent _zodSchema.)

    const svc = new DocumentsService(db, {
      queryableFields: docType.queryableFields,
      typeSchemaVersion: docType.schemaVersion,
      maxVersionsPerRoot: docType.settings.maxVersionsPerRoot,
    })

    // Inject tenant from context (POC: always 'default').
    const doc = await svc.create({ ...input, tenantId: 'default' }, user.userId)

    return c.json({ data: doc }, 201)
  } catch (error) {
    console.error('Error creating document:', error)
    return c.json({ error: 'Failed to create document' }, 500)
  }
})

// ─── Save new draft ───────────────────────────────────────────────────────────
adminDocumentsRoutes.put('/:rootId', async (c) => {
  try {
    const contentType = c.req.header('Content-Type')
    if (!contentType?.includes('application/json')) {
      return c.json({ error: 'Content-Type must be application/json' }, 400)
    }

    let body: unknown
    try { body = await c.req.json() } catch {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }

    const validation = updateDocumentSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: 'Validation failed', details: validation.error.issues }, 400)
    }

    const { rootId } = c.req.param()
    const db = c.env.DB
    const user = c.get('user') as { userId: string; email: string; role: string }

    // Look up the type from the existing draft to get queryableFields.
    const existing = await db
      .prepare('SELECT type_id FROM documents WHERE root_id = ? AND is_current_draft = 1')
      .bind(rootId)
      .first() as any

    if (!existing) return c.json({ error: 'Document not found' }, 404)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(existing.type_id)

    const svc = new DocumentsService(db, {
      queryableFields: docType?.queryableFields ?? [],
      typeSchemaVersion: docType?.schemaVersion,
      maxVersionsPerRoot: docType?.settings.maxVersionsPerRoot,
    })

    const doc = await svc.saveDraft(rootId, validation.data, user.userId)
    return c.json({ data: doc })
  } catch (error: any) {
    if (error?.message?.includes('No current draft found')) return c.json({ error: 'Document not found' }, 404)
    console.error('Error saving draft:', error)
    return c.json({ error: 'Failed to save draft' }, 500)
  }
})

// ─── Publish ──────────────────────────────────────────────────────────────────
adminDocumentsRoutes.post('/:id/publish', async (c) => {
  try {
    const { id } = c.req.param()
    const db = c.env.DB
    const user = c.get('user') as { userId: string; email: string; role: string }

    const row = await db.prepare('SELECT type_id FROM documents WHERE id = ?').bind(id).first() as any
    if (!row) return c.json({ error: 'Document not found' }, 404)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)

    const svc = new DocumentsService(db, {
      queryableFields: docType?.queryableFields ?? [],
      typeSchemaVersion: docType?.schemaVersion,
    })

    const doc = await svc.publish(id, user.userId)
    return c.json({ data: doc })
  } catch (error: any) {
    if (error?.message?.includes('not found')) return c.json({ error: 'Document not found' }, 404)
    console.error('Error publishing document:', error)
    return c.json({ error: 'Failed to publish document' }, 500)
  }
})

// ─── Unpublish ────────────────────────────────────────────────────────────────
adminDocumentsRoutes.post('/:id/unpublish', async (c) => {
  try {
    const { id } = c.req.param()
    const db = c.env.DB

    const row = await db.prepare('SELECT type_id FROM documents WHERE id = ?').bind(id).first() as any
    if (!row) return c.json({ error: 'Document not found' }, 404)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)

    const svc = new DocumentsService(db, {
      queryableFields: docType?.queryableFields ?? [],
    })

    const doc = await svc.unpublish(id)
    return c.json({ data: doc })
  } catch (error: any) {
    if (error?.message?.includes('not found')) return c.json({ error: 'Document not found' }, 404)
    if (error?.message?.includes('not published')) return c.json({ error: 'Document is not published' }, 400)
    console.error('Error unpublishing document:', error)
    return c.json({ error: 'Failed to unpublish document' }, 500)
  }
})

// ─── Soft delete ──────────────────────────────────────────────────────────────
adminDocumentsRoutes.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const db = c.env.DB

    const row = await db.prepare('SELECT type_id FROM documents WHERE id = ?').bind(id).first() as any
    if (!row) return c.json({ error: 'Document not found' }, 404)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)

    const svc = new DocumentsService(db, { queryableFields: docType?.queryableFields ?? [] })

    // Hard erase PII types; soft delete others.
    if (docType?.settings.pii) {
      const rootId = (await db.prepare('SELECT root_id FROM documents WHERE id = ?').bind(id).first() as any)?.root_id
      if (rootId) await svc.erase(rootId, 'default')
    } else {
      await svc.softDelete(id)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return c.json({ error: 'Failed to delete document' }, 500)
  }
})

// ─── Reindex a type (repair derived rows) ────────────────────────────────────
adminDocumentsRoutes.post('/types/:typeId/reindex', async (c) => {
  try {
    const { typeId } = c.req.param()
    const db = c.env.DB

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType) return c.json({ error: 'Unknown document type' }, 400)

    const { DocumentProjection } = await import('../services/document-projection')
    const projection = new DocumentProjection(db)
    const rebuilt = await projection.reindexType(typeId, 'default', docType.queryableFields)

    return c.json({ rebuilt })
  } catch (error) {
    console.error('Error reindexing type:', error)
    return c.json({ error: 'Failed to reindex type' }, 500)
  }
})

export { adminDocumentsRoutes }
export default adminDocumentsRoutes
