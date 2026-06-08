import { Hono } from 'hono'
import { requireAuth, requireRole, optionalAuth } from '../middleware'
import { canReadNonPublicContent } from './api-content-access-policy'
import { getCacheService, CACHE_CONFIGS } from '../services'
import type { Bindings, Variables } from '../app'
import { resolveContentVariables } from '../plugins/core-plugins/global-variables-plugin/variable-resolver'
import { DocumentsService, documentSecondsToMs } from '../services/documents'
import { DocumentTypeRegistry } from '../services/document-type-registry'
import { createDocumentSchema } from '../schemas/document'
import type { D1Database } from '@cloudflare/workers-types'

const apiContentCrudRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Resolve the document type backing a content collection (by collection db id OR name). When present
// the write goes to the documents table (legacy `content` decommission); otherwise legacy content.
async function resolveDocBacking(db: D1Database, collectionIdOrName: string) {
  const coll = await db
    .prepare('SELECT id, name FROM collections WHERE id = ? OR name = ?')
    .bind(collectionIdOrName, collectionIdOrName)
    .first() as { id: string; name: string } | null
  if (!coll) return null
  const docType = await new DocumentTypeRegistry(db).findById(coll.name)
  return docType ? { coll, docType } : null
}

function slugify(s?: string | null): string | null {
  if (!s) return null
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || null
}

// GET /api/content/check-slug - Check if slug is available in collection
// Query params: collectionId, slug, excludeId (optional - when editing)
// NOTE: This MUST come before /:id route to avoid route conflict
apiContentCrudRoutes.get('/check-slug', async (c) => {
  try {
    const db = c.env.DB
    const collectionId = c.req.query('collectionId')
    const slug = c.req.query('slug')
    const excludeId = c.req.query('excludeId') // When editing, exclude current item
    
    if (!collectionId || !slug) {
      return c.json({ error: 'collectionId and slug are required' }, 400)
    }
    
    // Check for existing content with this slug in the collection
    let query = 'SELECT id FROM content WHERE collection_id = ? AND slug = ?'
    const params: string[] = [collectionId, slug]
    
    if (excludeId) {
      query += ' AND id != ?'
      params.push(excludeId)
    }
    
    const existing = await db.prepare(query).bind(...params).first()

    if (existing) {
      return c.json({
        available: false,
        message: 'This URL slug is already in use in this collection'
      })
    }

    // Also check document-backed content (slug uniqueness per type == collection name).
    const coll = await db.prepare('SELECT name FROM collections WHERE id = ?').bind(collectionId).first() as any
    if (coll?.name) {
      // D37: a slug is taken if ANY live revision uses it — the current draft OR a still-served
      // published row (a superseded published row keeps its slug until replaced).
      let docQuery = "SELECT root_id FROM documents WHERE type_id = ? AND tenant_id = 'default' AND (is_current_draft = 1 OR is_published = 1) AND deleted_at IS NULL AND slug = ?"
      const docParams: string[] = [coll.name, slug]
      if (excludeId) { docQuery += ' AND root_id != ?'; docParams.push(excludeId) }
      const docExisting = await db.prepare(docQuery).bind(...docParams).first()
      if (docExisting) {
        return c.json({ available: false, message: 'This URL slug is already in use in this collection' })
      }
    }

    return c.json({ available: true })
  } catch (error: unknown) {
    console.error('Error checking slug:', error)
    return c.json({ 
      error: 'Failed to check slug availability',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// GET /api/content/:id - Get single content item by ID
apiContentCrudRoutes.get('/:id', optionalAuth(), async (c) => {
  try {
    const id = c.req.param('id')
    const db = c.env.DB

    // Document-backed: /api/content returns document root ids, so resolve by root id, falling back to a
    // legacy content row. D30: role-gate visibility like the list — privileged callers (admin/editor)
    // see the current-draft revision (so a brand-new DRAFT resolves, not 404); anon sees the published
    // revision only.
    const privileged = canReadNonPublicContent(c.get('user')?.role)
    const docRow = await db
      .prepare(
        privileged
          ? "SELECT * FROM documents WHERE root_id = ? AND tenant_id = 'default' AND is_current_draft = 1 AND deleted_at IS NULL"
          : "SELECT * FROM documents WHERE root_id = ? AND tenant_id = 'default' AND is_published = 1 AND deleted_at IS NULL",
      )
      .bind(id)
      .first() as any

    let transformedContent: any
    if (docRow) {
      const coll = await db.prepare('SELECT id FROM collections WHERE name = ?').bind(docRow.type_id).first() as any
      transformedContent = {
        id: docRow.root_id,
        title: docRow.title,
        slug: docRow.slug,
        status: docRow.status,
        collectionId: coll?.id ?? docRow.type_id,
        data: docRow.data ? JSON.parse(docRow.data) : {},
        // D29: document timestamps are SECONDS; legacy `content` API contract is MILLISECONDS.
        created_at: documentSecondsToMs(docRow.created_at),
        updated_at: documentSecondsToMs(docRow.updated_at),
      }
    } else {
      const content = await db.prepare('SELECT * FROM content WHERE id = ?').bind(id).first() as any
      if (!content) {
        return c.json({ error: 'Content not found' }, 404)
      }
      transformedContent = {
        id: content.id,
        title: content.title,
        slug: content.slug,
        status: content.status,
        collectionId: content.collection_id,
        data: content.data ? JSON.parse(content.data) : {},
        created_at: content.created_at,
        updated_at: content.updated_at,
      }
    }

    // Resolve {variable_key} tokens in content data
    const resolveVars = c.req.query('resolve_variables') !== 'false'
    if (resolveVars) {
      transformedContent.data = await resolveContentVariables(transformedContent.data, db)
    }

    return c.json({ data: transformedContent })
  } catch (error) {
    console.error('Error fetching content:', error)
    return c.json({
      error: 'Failed to fetch content',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// POST /api/content - Create new content (requires authentication)
apiContentCrudRoutes.post('/', requireAuth(), requireRole(['admin', 'editor', 'author']), async (c) => {
  try {
    const db = c.env.DB
    const user = c.get('user')
    const body = await c.req.json()

    const { collectionId, title, slug, status, data } = body

    // Validate required fields
    if (!collectionId) {
      return c.json({ error: 'collectionId is required' }, 400)
    }

    if (!title) {
      return c.json({ error: 'title is required' }, 400)
    }

    // Generate slug from title if not provided
    let finalSlug = slug || title
    finalSlug = finalSlug.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Document-backed collection → create a document (legacy content decommission).
    const backing = await resolveDocBacking(db, collectionId)
    if (backing) {
      const dup = await db
        // D37: reject if the slug is used by any live revision (current draft OR served published row).
        .prepare("SELECT root_id FROM documents WHERE type_id = ? AND tenant_id = 'default' AND (is_current_draft = 1 OR is_published = 1) AND deleted_at IS NULL AND slug = ?")
        .bind(backing.coll.name, finalSlug)
        .first()
      if (dup) {
        return c.json({ error: 'A content item with this slug already exists in this collection' }, 409)
      }
      const svc = new DocumentsService(db, {
        queryableFields: backing.docType.queryableFields ?? [],
        typeSchemaVersion: backing.docType.schemaVersion ?? 1,
        maxVersionsPerRoot: backing.docType.settings?.maxVersionsPerRoot ?? 50,
        tenantId: 'default',
      })
      const doc = await svc.create(
        createDocumentSchema.parse({
          typeId: backing.coll.name, tenantId: 'default', locale: 'default',
          title, slug: finalSlug, data: data || {}, publishOnCreate: (status || 'draft') === 'published',
        }),
        user?.userId,
      )
      const cache = getCacheService(CACHE_CONFIGS.api!)
      await cache.invalidate('content-filtered:*')
      await cache.invalidate('collection-content-filtered:*')
      return c.json({
        data: { id: doc.rootId, title: doc.title, slug: doc.slug, status: doc.status, collectionId: backing.coll.id, data: doc.data, created_at: documentSecondsToMs(doc.createdAt), updated_at: documentSecondsToMs(doc.updatedAt) },
      }, 201)
    }

    // Check for duplicate slug within the same collection (legacy content path)
    const duplicateCheck = db.prepare(
      'SELECT id FROM content WHERE collection_id = ? AND slug = ?'
    )
    const existing = await duplicateCheck.bind(collectionId, finalSlug).first()

    if (existing) {
      return c.json({ error: 'A content item with this slug already exists in this collection' }, 409)
    }

    // Create new content
    const contentId = crypto.randomUUID()
    const now = Date.now()

    const insertStmt = db.prepare(`
      INSERT INTO content (
        id, collection_id, slug, title, data, status,
        author_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await insertStmt.bind(
      contentId,
      collectionId,
      finalSlug,
      title,
      JSON.stringify(data || {}),
      status || 'draft',
      user?.userId || 'system',
      now,
      now
    ).run()

    // Invalidate cache
    const cache = getCacheService(CACHE_CONFIGS.api!)
    await cache.invalidate(`content:list:${collectionId}:*`)
    await cache.invalidate('content-filtered:*')

    // Get the created content
    const getStmt = db.prepare('SELECT * FROM content WHERE id = ?')
    const createdContent = await getStmt.bind(contentId).first() as any

    return c.json({
      data: {
        id: createdContent.id,
        title: createdContent.title,
        slug: createdContent.slug,
        status: createdContent.status,
        collectionId: createdContent.collection_id,
        data: createdContent.data ? JSON.parse(createdContent.data) : {},
        created_at: createdContent.created_at,
        updated_at: createdContent.updated_at
      }
    }, 201)
  } catch (error) {
    console.error('Error creating content:', error)
    return c.json({
      error: 'Failed to create content',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// PUT /api/content/:id - Update content (requires authentication)
apiContentCrudRoutes.put('/:id', requireAuth(), requireRole(['admin', 'editor', 'author']), async (c) => {
  try {
    const id = c.req.param('id')
    const db = c.env.DB
    const body = await c.req.json()
    const user = c.get('user')

    // Document-backed: :id is a document root id → save a new draft and sync publish state. D39: skip
    // soft-deleted roots (so PUT can't resurrect one) → falls through to the legacy path → 404.
    const docRow = await db
      .prepare("SELECT root_id, type_id FROM documents WHERE root_id = ? AND tenant_id = 'default' AND is_current_draft = 1 AND deleted_at IS NULL")
      .bind(id)
      .first() as any
    if (docRow) {
      const docType = await new DocumentTypeRegistry(db).findById(docRow.type_id)
      const svc = new DocumentsService(db, {
        queryableFields: docType?.queryableFields ?? [],
        typeSchemaVersion: docType?.schemaVersion ?? 1,
        maxVersionsPerRoot: docType?.settings?.maxVersionsPerRoot ?? 50,
        tenantId: 'default',
      })
      const input: any = {}
      if (body.title !== undefined) input.title = body.title
      if (body.slug !== undefined) input.slug = slugify(body.slug)
      if (body.data !== undefined) input.data = body.data
      const newDraft = await svc.saveDraft(id!, input, user?.userId)
      const pub = await db.prepare("SELECT id FROM documents WHERE root_id = ? AND is_published = 1 AND tenant_id = 'default'").bind(id).first() as any
      // D38: an explicit status wins; with NO status, preserve the prior effective state — editing a
      // published item keeps it published (legacy parity), a draft stays a draft.
      if (body.status === 'published' || (body.status === undefined && pub)) {
        await svc.publish(newDraft.id, user?.userId)
      } else if (body.status === 'draft' && pub) {
        await svc.unpublish(pub.id)
      }
      const cache = getCacheService(CACHE_CONFIGS.api!)
      await cache.invalidate('content-filtered:*')
      await cache.invalidate('collection-content-filtered:*')
      const coll = await db.prepare('SELECT id FROM collections WHERE name = ?').bind(docRow.type_id).first() as any
      const saved = await db.prepare('SELECT * FROM documents WHERE id = ?').bind(newDraft.id).first() as any
      return c.json({
        data: { id: saved.root_id, title: saved.title, slug: saved.slug, status: saved.status, collectionId: coll?.id ?? docRow.type_id, data: saved.data ? JSON.parse(saved.data) : {}, created_at: documentSecondsToMs(saved.created_at), updated_at: documentSecondsToMs(saved.updated_at) },
      })
    }

    // Check if content exists (legacy content path)
    const existingStmt = db.prepare('SELECT * FROM content WHERE id = ?')
    const existing = await existingStmt.bind(id).first() as any

    if (!existing) {
      return c.json({ error: 'Content not found' }, 404)
    }

    // Build update fields dynamically
    const updates: string[] = []
    const params: any[] = []

    if (body.title !== undefined) {
      updates.push('title = ?')
      params.push(body.title)
    }

    if (body.slug !== undefined) {
      let finalSlug = body.slug.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      updates.push('slug = ?')
      params.push(finalSlug)
    }

    if (body.status !== undefined) {
      updates.push('status = ?')
      params.push(body.status)
    }

    if (body.data !== undefined) {
      updates.push('data = ?')
      params.push(JSON.stringify(body.data))
    }

    // Always update updated_at
    const now = Date.now()
    updates.push('updated_at = ?')
    params.push(now)

    // Add id to params for WHERE clause
    params.push(id)

    // Execute update
    const updateStmt = db.prepare(`
      UPDATE content SET ${updates.join(', ')}
      WHERE id = ?
    `)

    await updateStmt.bind(...params).run()

    // Invalidate cache
    const cache = getCacheService(CACHE_CONFIGS.api!)
    await cache.delete(cache.generateKey('content', id))
    await cache.invalidate(`content:list:${existing.collection_id}:*`)
    await cache.invalidate('content-filtered:*')

    // Get updated content
    const getStmt = db.prepare('SELECT * FROM content WHERE id = ?')
    const updatedContent = await getStmt.bind(id).first() as any

    return c.json({
      data: {
        id: updatedContent.id,
        title: updatedContent.title,
        slug: updatedContent.slug,
        status: updatedContent.status,
        collectionId: updatedContent.collection_id,
        data: updatedContent.data ? JSON.parse(updatedContent.data) : {},
        created_at: updatedContent.created_at,
        updated_at: updatedContent.updated_at
      }
    })
  } catch (error) {
    console.error('Error updating content:', error)
    return c.json({
      error: 'Failed to update content',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// DELETE /api/content/:id - Delete content (requires authentication)
apiContentCrudRoutes.delete('/:id', requireAuth(), requireRole(['admin', 'editor', 'author']), async (c) => {
  try {
    const id = c.req.param('id')
    const db = c.env.DB

    // Document-backed: :id is a document root id → soft-delete every version row of the root. D39:
    // ignore an already soft-deleted root so a second DELETE falls through to the legacy path → 404
    // (matching main, which hard-deleted and 404'd on re-delete) instead of a misleading {success:true}.
    const docRow = await db.prepare("SELECT type_id FROM documents WHERE root_id = ? AND tenant_id = 'default' AND deleted_at IS NULL LIMIT 1").bind(id).first() as any
    if (docRow) {
      const now = Math.floor(Date.now() / 1000)
      await db.prepare("UPDATE documents SET deleted_at = ?, updated_at = ? WHERE root_id = ? AND tenant_id = 'default'").bind(now, now, id).run()
      const cache = getCacheService(CACHE_CONFIGS.api!)
      await cache.invalidate('content-filtered:*')
      await cache.invalidate('collection-content-filtered:*')
      return c.json({ success: true })
    }

    // Check if content exists (legacy content path)
    const existingStmt = db.prepare('SELECT collection_id FROM content WHERE id = ?')
    const existing = await existingStmt.bind(id).first() as any

    if (!existing) {
      return c.json({ error: 'Content not found' }, 404)
    }

    // Delete the content (hard delete for API, soft delete happens in admin routes)
    const deleteStmt = db.prepare('DELETE FROM content WHERE id = ?')
    await deleteStmt.bind(id).run()

    // Invalidate cache
    const cache = getCacheService(CACHE_CONFIGS.api!)
    await cache.delete(cache.generateKey('content', id))
    await cache.invalidate(`content:list:${existing.collection_id}:*`)
    await cache.invalidate('content-filtered:*')

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting content:', error)
    return c.json({
      error: 'Failed to delete content',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

export default apiContentCrudRoutes
