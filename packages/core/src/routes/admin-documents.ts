import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Bindings, Variables } from '../app'
import { z } from 'zod'
import { DocumentsService } from '../services/documents'
import { DocumentTypeRegistry } from '../services/document-type-registry'
import { DocumentRepository } from '../services/document-repository'
import { createDocumentSchema, updateDocumentSchema } from '../schemas/document'
import {
  renderDocumentTypesPage,
  renderDocumentsListPage,
} from '../templates/pages/admin-documents-list.template'
import {
  renderDocumentFormPage,
  renderVersionHistoryFragment,
} from '../templates/pages/admin-documents-form.template'

const adminDocumentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminDocumentsRoutes.use('*', requireAuth())
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

    const dataValidation = docType.schema ? (docType as any)._zodSchema?.safeParse(input.data) : null

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

// ═══════════════════════════════════════════════════════════════════════════════
// HTML UI ROUTES  (/admin/documents/ui/…)
// ═══════════════════════════════════════════════════════════════════════════════

function userFromCtx(c: any) {
  const u = c.get('user')
  return u ? { name: u.email, email: u.email, role: u.role } : undefined
}

// Helpers to parse form-submitted document data fields.
function parseFormData(formData: FormData): { title: string | null; slug: string | null; data: Record<string, unknown> } {
  const title = (formData.get('title') as string | null) || null
  const slug = (formData.get('slug') as string | null) || null
  const data: Record<string, unknown> = {}

  for (const [key, val] of formData.entries()) {
    if (key.startsWith('data[') && key.endsWith(']')) {
      const fieldName = key.slice(5, -1)
      const strVal = val as string
      // Detect comma-separated facet values (arrays)
      if (strVal.includes(',') && !strVal.startsWith('{')) {
        data[fieldName] = strVal.split(',').map(s => s.trim()).filter(Boolean)
      } else if (strVal === 'true') {
        data[fieldName] = true
      } else if (strVal === 'false') {
        data[fieldName] = false
      } else if (strVal !== '' && !isNaN(Number(strVal)) && strVal.trim() !== '') {
        data[fieldName] = Number(strVal)
      } else {
        data[fieldName] = strVal
      }
    }
  }

  return { title, slug, data }
}

// ─── Landing: document type selector ─────────────────────────────────────────
adminDocumentsRoutes.get('/ui', async (c) => {
  try {
    const registry = new DocumentTypeRegistry(c.env.DB)
    const types = await registry.findAll()
    const message = c.req.query('message')
    const messageType = (c.req.query('messageType') ?? 'info') as 'success' | 'error' | 'info'

    return c.html(renderDocumentTypesPage({
      types,
      message,
      messageType,
      user: userFromCtx(c),
    }))
  } catch (error) {
    console.error('Error loading document types:', error)
    return c.html('<p>Error loading document types.</p>', 500)
  }
})

// ─── Document list for a type ─────────────────────────────────────────────────
adminDocumentsRoutes.get('/ui/:typeId', async (c) => {
  try {
    const { typeId } = c.req.param()
    const db = c.env.DB
    const status = (c.req.query('status') ?? 'all') as string
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 200)
    const cursorUpdatedAt = c.req.query('cursor_updated_at') ? parseInt(c.req.query('cursor_updated_at')!, 10) : undefined
    const cursorId = c.req.query('cursor_id') ?? undefined
    const message = c.req.query('message')
    const messageType = (c.req.query('messageType') ?? 'info') as 'success' | 'error' | 'info'

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<p>Unknown document type.</p>', 404)

    const params: (string | number)[] = ['default', typeId]
    let sql = 'SELECT * FROM documents WHERE tenant_id = ? AND type_id = ? AND deleted_at IS NULL'

    if (status === 'draft') sql += ' AND is_current_draft = 1'
    else if (status === 'published') sql += ' AND is_published = 1'
    else sql += ' AND (is_current_draft = 1 OR is_published = 1)'

    if (cursorUpdatedAt !== undefined && cursorId) {
      sql += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))'
      params.push(cursorUpdatedAt, cursorUpdatedAt, cursorId)
    }

    sql += ' ORDER BY updated_at DESC, id DESC LIMIT ?'
    params.push(limit + 1) // fetch one extra to detect next page

    const result = await db.prepare(sql).bind(...params).all()
    const rows = (result.results ?? []) as any[]
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map((r: any) => ({
      id: r.id, rootId: r.root_id, typeId: r.type_id, title: r.title, slug: r.slug,
      status: r.status, isCurrentDraft: r.is_current_draft === 1, isPublished: r.is_published === 1,
      versionNumber: r.version_number, locale: r.locale, publishedAt: r.published_at,
      updatedAt: r.updated_at, data: JSON.parse(r.data ?? '{}'),
    }))

    const lastItem = items[items.length - 1]
    const nextCursor = hasMore && lastItem
      ? { cursor_updated_at: lastItem.updatedAt, cursor_id: lastItem.id }
      : null

    return c.html(renderDocumentsListPage({
      docType,
      items,
      filters: { status, limit },
      nextCursor,
      message,
      messageType,
      user: userFromCtx(c),
    }))
  } catch (error) {
    console.error('Error loading document list:', error)
    return c.html('<p>Error loading documents.</p>', 500)
  }
})

// ─── New document form ────────────────────────────────────────────────────────
adminDocumentsRoutes.get('/ui/:typeId/new', async (c) => {
  try {
    const { typeId } = c.req.param()
    const registry = new DocumentTypeRegistry(c.env.DB)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<p>Unknown document type.</p>', 404)

    return c.html(renderDocumentFormPage({ docType, isEdit: false, user: userFromCtx(c) }))
  } catch (error) {
    return c.html('<p>Error loading form.</p>', 500)
  }
})

// ─── Create document (HTML form POST) ────────────────────────────────────────
adminDocumentsRoutes.post('/ui/:typeId/new', async (c) => {
  try {
    const { typeId } = c.req.param()
    const db = c.env.DB
    const user = c.get('user') as any

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<p>Unknown document type.</p>', 404)

    const formData = await c.req.formData()
    const { title, slug, data } = parseFormData(formData)

    const svc = new DocumentsService(db, {
      queryableFields: docType.queryableFields,
      typeSchemaVersion: docType.schemaVersion,
      maxVersionsPerRoot: docType.settings.maxVersionsPerRoot,
    })

    const doc = await svc.create(createDocumentSchema.parse({
      typeId, tenantId: 'default', locale: 'default',
      title: title ?? undefined, slug: slug ?? undefined, data,
    }), user?.userId)

    return c.redirect(`/admin/documents/ui/${typeId}/${doc.rootId}/edit?message=Created+successfully&messageType=success`)
  } catch (error: any) {
    const { typeId } = c.req.param()
    const registry = new DocumentTypeRegistry(c.env.DB)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<p>Unknown document type.</p>', 404)
    return c.html(renderDocumentFormPage({
      docType, isEdit: false, user: userFromCtx(c),
      message: `Failed to create: ${error?.message ?? 'Unknown error'}`, messageType: 'error',
    }))
  }
})

// ─── Edit form ────────────────────────────────────────────────────────────────
adminDocumentsRoutes.get('/ui/:typeId/:rootId/edit', async (c) => {
  try {
    const { typeId, rootId } = c.req.param()
    const db = c.env.DB
    const message = c.req.query('message')
    const messageType = (c.req.query('messageType') ?? 'info') as 'success' | 'error' | 'info'

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<p>Unknown document type.</p>', 404)

    const draftRow = await db.prepare(
      'SELECT * FROM documents WHERE root_id = ? AND tenant_id = ? AND is_current_draft = 1'
    ).bind(rootId, 'default').first() as any

    if (!draftRow) return c.html('<p>Document not found.</p>', 404)

    // Also fetch the published revision if it's a different row.
    let publishedDoc = null
    if (!draftRow.is_published) {
      const pubRow = await db.prepare(
        'SELECT * FROM documents WHERE root_id = ? AND tenant_id = ? AND is_published = 1'
      ).bind(rootId, 'default').first() as any
      if (pubRow) {
        publishedDoc = {
          id: pubRow.id, rootId: pubRow.root_id, typeId: pubRow.type_id,
          versionNumber: pubRow.version_number, isCurrentDraft: false, isPublished: true,
          status: pubRow.status, data: JSON.parse(pubRow.data ?? '{}'),
        } as any
      }
    }

    const doc = {
      id: draftRow.id, rootId: draftRow.root_id, typeId: draftRow.type_id,
      typeVersion: draftRow.type_version, versionOfId: draftRow.version_of_id,
      versionNumber: draftRow.version_number, isCurrentDraft: draftRow.is_current_draft === 1,
      isPublished: draftRow.is_published === 1, status: draftRow.status,
      parentRootId: draftRow.parent_root_id, slug: draftRow.slug, path: draftRow.path,
      title: draftRow.title, zone: draftRow.zone, sortOrder: draftRow.sort_order,
      visible: draftRow.visible === 1, publishedAt: draftRow.published_at,
      scheduledAt: draftRow.scheduled_at, expiresAt: draftRow.expires_at,
      deletedAt: draftRow.deleted_at, tenantId: draftRow.tenant_id, locale: draftRow.locale,
      translationGroupId: draftRow.translation_group_id, data: JSON.parse(draftRow.data ?? '{}'),
      metadata: JSON.parse(draftRow.metadata ?? '{}'), ownerId: draftRow.owner_id,
      createdBy: draftRow.created_by, updatedBy: draftRow.updated_by,
      createdAt: draftRow.created_at, updatedAt: draftRow.updated_at,
    } as any

    return c.html(renderDocumentFormPage({
      docType, doc, publishedDoc, isEdit: true, message, messageType, user: userFromCtx(c),
    }))
  } catch (error) {
    return c.html('<p>Error loading document.</p>', 500)
  }
})

// ─── Save draft (HTML form PUT via hidden _method) ────────────────────────────
adminDocumentsRoutes.post('/ui/:typeId/:rootId', async (c) => {
  const { typeId, rootId } = c.req.param()
  const db = c.env.DB
  const user = c.get('user') as any

  try {
    const formData = await c.req.formData()
    const method = formData.get('_method') as string | null

    if (method === 'PUT') {
      // Save as new draft
      const { title, slug, data } = parseFormData(formData)
      const existingRow = await db.prepare('SELECT type_id FROM documents WHERE root_id = ? AND is_current_draft = 1').bind(rootId).first() as any
      if (!existingRow) return c.redirect(`/admin/documents/ui/${typeId}?message=Document+not+found&messageType=error`)

      const registry = new DocumentTypeRegistry(db)
      const docType = await registry.findById(existingRow.type_id)

      const svc = new DocumentsService(db, {
        queryableFields: docType?.queryableFields ?? [],
        typeSchemaVersion: docType?.schemaVersion,
        maxVersionsPerRoot: docType?.settings.maxVersionsPerRoot,
      })

      await svc.saveDraft(rootId, { title, slug, data }, user?.userId)
      return c.redirect(`/admin/documents/ui/${typeId}/${rootId}/edit?message=Draft+saved&messageType=success`)
    }

    return c.redirect(`/admin/documents/ui/${typeId}/${rootId}/edit?message=Unknown+action&messageType=error`)
  } catch (error: any) {
    return c.redirect(`/admin/documents/ui/${typeId}/${rootId}/edit?message=${encodeURIComponent(error?.message ?? 'Save failed')}&messageType=error`)
  }
})

// ─── Publish (HTML form POST) ─────────────────────────────────────────────────
adminDocumentsRoutes.post('/ui/:typeId/:documentId/publish', async (c) => {
  const { typeId, documentId } = c.req.param()
  const db = c.env.DB
  const user = c.get('user') as any

  try {
    const row = await db.prepare('SELECT type_id, root_id FROM documents WHERE id = ?').bind(documentId).first() as any
    if (!row) return c.redirect(`/admin/documents/ui/${typeId}?message=Document+not+found&messageType=error`)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)
    const svc = new DocumentsService(db, { queryableFields: docType?.queryableFields ?? [] })
    await svc.publish(documentId, user?.userId)

    return c.redirect(`/admin/documents/ui/${typeId}/${row.root_id}/edit?message=Published&messageType=success`)
  } catch (error: any) {
    return c.redirect(`/admin/documents/ui/${typeId}?message=${encodeURIComponent(error?.message ?? 'Publish failed')}&messageType=error`)
  }
})

// ─── Unpublish (HTML form POST) ───────────────────────────────────────────────
adminDocumentsRoutes.post('/ui/:typeId/:documentId/unpublish', async (c) => {
  const { typeId, documentId } = c.req.param()
  const db = c.env.DB

  try {
    const row = await db.prepare('SELECT type_id, root_id FROM documents WHERE id = ?').bind(documentId).first() as any
    if (!row) return c.redirect(`/admin/documents/ui/${typeId}?message=Document+not+found&messageType=error`)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)
    const svc = new DocumentsService(db, { queryableFields: docType?.queryableFields ?? [] })
    await svc.unpublish(documentId)

    return c.redirect(`/admin/documents/ui/${typeId}/${row.root_id}/edit?message=Unpublished&messageType=success`)
  } catch (error: any) {
    return c.redirect(`/admin/documents/ui/${typeId}?message=${encodeURIComponent(error?.message ?? 'Unpublish failed')}&messageType=error`)
  }
})

// ─── Delete (HTML form POST) ──────────────────────────────────────────────────
adminDocumentsRoutes.post('/ui/:typeId/:documentId/delete', async (c) => {
  const { typeId, documentId } = c.req.param()
  const db = c.env.DB

  try {
    const row = await db.prepare('SELECT type_id FROM documents WHERE id = ?').bind(documentId).first() as any
    if (!row) return c.redirect(`/admin/documents/ui/${typeId}?message=Document+not+found&messageType=error`)

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(row.type_id)
    const svc = new DocumentsService(db, { queryableFields: docType?.queryableFields ?? [] })

    if (docType?.settings.pii) {
      const rootRow = await db.prepare('SELECT root_id FROM documents WHERE id = ?').bind(documentId).first() as any
      if (rootRow) await svc.erase(rootRow.root_id, 'default')
    } else {
      await svc.softDelete(documentId)
    }

    return c.redirect(`/admin/documents/ui/${typeId}?message=Deleted&messageType=success`)
  } catch (error: any) {
    return c.redirect(`/admin/documents/ui/${typeId}?message=${encodeURIComponent(error?.message ?? 'Delete failed')}&messageType=error`)
  }
})

// ─── Version history fragment (HTMX) ─────────────────────────────────────────
adminDocumentsRoutes.get('/ui/:typeId/:rootId/versions', async (c) => {
  try {
    const { typeId, rootId } = c.req.param()
    const db = c.env.DB

    const result = await db.prepare(
      'SELECT id, version_number, is_current_draft, is_published, status, updated_at, created_by FROM documents WHERE root_id = ? AND tenant_id = ? ORDER BY version_number DESC LIMIT 50'
    ).bind(rootId, 'default').all()

    const registry = new DocumentTypeRegistry(db)
    const docType = await registry.findById(typeId)
    if (!docType) return c.html('<div>Unknown type.</div>', 404)

    const versions = (result.results ?? []).map((r: any) => ({
      id: r.id, versionNumber: r.version_number, isCurrentDraft: r.is_current_draft === 1,
      isPublished: r.is_published === 1, status: r.status, updatedAt: r.updated_at, createdBy: r.created_by,
    }))

    return c.html(renderVersionHistoryFragment({ versions, docType, rootId }))
  } catch (error) {
    return c.html('<div class="px-6 py-4 text-sm text-red-500">Error loading versions.</div>', 500)
  }
})

export { adminDocumentsRoutes }
export default adminDocumentsRoutes
