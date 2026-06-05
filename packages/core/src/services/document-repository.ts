import { D1Database } from '@cloudflare/workers-types'
import type { Document, DocumentRow, PrincipalRef, Permission, DocumentTypeSettings } from '../schemas/document'
import { DocumentPermissionsService } from './document-permissions'

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    rootId: row.root_id,
    typeId: row.type_id,
    typeVersion: row.type_version,
    versionOfId: row.version_of_id,
    versionNumber: row.version_number,
    isCurrentDraft: row.is_current_draft === 1,
    isPublished: row.is_published === 1,
    status: row.status,
    parentRootId: row.parent_root_id,
    slug: row.slug,
    path: row.path,
    title: row.title,
    zone: row.zone,
    sortOrder: row.sort_order,
    visible: row.visible === 1,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
    tenantId: row.tenant_id,
    locale: row.locale,
    translationGroupId: row.translation_group_id,
    data: JSON.parse(row.data),
    metadata: JSON.parse(row.metadata),
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface ListDocumentsOptions {
  typeId?: string
  status?: 'draft' | 'published' | 'archived'
  locale?: string
  parentRootId?: string
  limit?: number
  cursorUpdatedAt?: number
  cursorId?: string
  now?: number
}

// Single tenant-scoped data-access chokepoint. All reads and writes go through here.
// tenant_id is injected from constructor context; route handlers never build raw SQL.
export class DocumentRepository {
  private permissions: DocumentPermissionsService

  constructor(
    private db: D1Database,
    private tenantId: string,
  ) {
    this.permissions = new DocumentPermissionsService(db)
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Document | null> {
    const row = await this.db
      .prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .first<DocumentRow>()
    return row ? rowToDocument(row) : null
  }

  async getCurrentDraft(rootId: string): Promise<Document | null> {
    const row = await this.db
      .prepare('SELECT * FROM documents WHERE root_id = ? AND tenant_id = ? AND is_current_draft = 1')
      .bind(rootId, this.tenantId)
      .first<DocumentRow>()
    return row ? rowToDocument(row) : null
  }

  async getPublished(rootId: string): Promise<Document | null> {
    const row = await this.db
      .prepare('SELECT * FROM documents WHERE root_id = ? AND tenant_id = ? AND is_published = 1')
      .bind(rootId, this.tenantId)
      .first<DocumentRow>()
    return row ? rowToDocument(row) : null
  }

  async listPublished(opts: ListDocumentsOptions = {}): Promise<Document[]> {
    const now = opts.now ?? Math.floor(Date.now() / 1000)
    const limit = Math.min(opts.limit ?? 50, 200)
    const params: (string | number)[] = [this.tenantId]

    let sql = `SELECT * FROM documents WHERE tenant_id = ? AND is_published = 1 AND deleted_at IS NULL
      AND (scheduled_at IS NULL OR scheduled_at <= ?) AND (expires_at IS NULL OR expires_at > ?)`
    params.push(now, now)

    if (opts.typeId) { sql += ' AND type_id = ?'; params.push(opts.typeId) }
    if (opts.locale) { sql += ' AND locale = ?'; params.push(opts.locale) }
    if (opts.parentRootId !== undefined) { sql += ' AND parent_root_id = ?'; params.push(opts.parentRootId) }

    if (opts.cursorUpdatedAt !== undefined && opts.cursorId) {
      sql += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))'
      params.push(opts.cursorUpdatedAt, opts.cursorUpdatedAt, opts.cursorId)
    }

    sql += ' ORDER BY updated_at DESC, id DESC LIMIT ?'
    params.push(limit)

    const result = await this.db.prepare(sql).bind(...params).all<DocumentRow>()
    return (result.results ?? []).map(rowToDocument)
  }

  async listDrafts(opts: ListDocumentsOptions = {}): Promise<Document[]> {
    const limit = Math.min(opts.limit ?? 50, 200)
    const params: (string | number)[] = [this.tenantId]

    let sql = 'SELECT * FROM documents WHERE tenant_id = ? AND is_current_draft = 1 AND deleted_at IS NULL'

    if (opts.typeId) { sql += ' AND type_id = ?'; params.push(opts.typeId) }
    if (opts.locale) { sql += ' AND locale = ?'; params.push(opts.locale) }

    if (opts.cursorUpdatedAt !== undefined && opts.cursorId) {
      sql += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))'
      params.push(opts.cursorUpdatedAt, opts.cursorUpdatedAt, opts.cursorId)
    }

    sql += ' ORDER BY updated_at DESC, id DESC LIMIT ?'
    params.push(limit)

    const result = await this.db.prepare(sql).bind(...params).all<DocumentRow>()
    return (result.results ?? []).map(rowToDocument)
  }

  async getVersionHistory(rootId: string): Promise<Document[]> {
    const result = await this.db
      .prepare('SELECT * FROM documents WHERE root_id = ? AND tenant_id = ? ORDER BY version_number DESC')
      .bind(rootId, this.tenantId)
      .all<DocumentRow>()
    return (result.results ?? []).map(rowToDocument)
  }

  // ─── "Where Used" lookup ──────────────────────────────────────────────────

  async getInboundReferences(toRootId: string): Promise<Array<{ fromDocumentId: string; fieldName: string; refStrength: string }>> {
    const result = await this.db
      .prepare(
        `SELECT r.from_document_id, r.field_name, r.ref_strength
         FROM document_references r
         JOIN documents d ON d.id = r.from_document_id
         WHERE r.tenant_id = ? AND r.to_root_id = ?
           AND (d.is_published = 1 OR d.is_current_draft = 1)
           AND d.deleted_at IS NULL`,
      )
      .bind(this.tenantId, toRootId)
      .all<{ from_document_id: string; field_name: string; ref_strength: string }>()

    return (result.results ?? []).map(r => ({
      fromDocumentId: r.from_document_id,
      fieldName: r.field_name,
      refStrength: r.ref_strength,
    }))
  }

  // ─── ACL ──────────────────────────────────────────────────────────────────

  async isAllowed(
    principalSet: PrincipalRef[],
    rootId: string,
    permission: Permission,
    typeSettings: DocumentTypeSettings,
  ): Promise<boolean> {
    return this.permissions.isAllowed(principalSet, rootId, permission, typeSettings, this.tenantId)
  }
}
