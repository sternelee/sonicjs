import { D1Database } from '@cloudflare/workers-types'
import type { Document, QueryableField } from '../schemas/document'
import { DocumentsService } from './documents'
import { DocumentRepository } from './document-repository'
import { createDocumentSchema } from '../schemas/document'

// Media as documents (Phase 6). File bytes stay in R2; metadata becomes a `media_asset` document.
// The document payload stores only intrinsic facts (r2Key, dimensions, mime…) — NOT publicUrl/
// thumbnailUrl, which are DERIVED at read time so the URL/transform strategy can change without
// rewriting stored data. The adapters below reproduce the legacy `media` row + MediaFile view-model
// shapes so existing consumers keep working.

export interface MediaUploadMeta {
  filename: string
  originalName: string
  mimeType: string
  size: number
  width?: number | null
  height?: number | null
  folder: string
  r2Key: string
  alt?: string
  caption?: string
  tags?: string[]
}

export interface MediaUrlOptions {
  /** R2 public host, e.g. 'pub-xxxx.r2.dev' (matches the upload path's publicUrl). */
  r2PublicHost?: string
  /** Cloudflare Images account id for thumbnail delivery. */
  imagesAccountId?: string
}

// media_asset queryable fields — mirror migration 043 (q_media_*) + the document type registration.
const MEDIA_QUERYABLE: QueryableField[] = [
  { name: 'mimeType', kind: 'scalar', type: 'text', column: 'q_media_mime' },
  { name: 'folder', kind: 'scalar', type: 'text', column: 'q_media_folder' },
  { name: 'size', kind: 'scalar', type: 'integer', column: 'q_media_size' },
  { name: 'tags', kind: 'facet', type: 'text' },
]

export function deriveMediaPublicUrl(r2Key: string, opts: MediaUrlOptions = {}): string {
  // Default matches the admin media library's serving route (/files/<r2Key>); pass r2PublicHost for
  // the public R2 domain instead.
  return opts.r2PublicHost ? `https://${opts.r2PublicHost}/${r2Key}` : `/files/${r2Key}`
}

export function deriveMediaThumbnailUrl(r2Key: string, mimeType: string, opts: MediaUrlOptions = {}): string | null {
  return mimeType.startsWith('image/') && opts.imagesAccountId
    ? `https://imagedelivery.net/${opts.imagesAccountId}/${r2Key}/thumbnail`
    : null
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Map a media_asset document to the legacy `media` table row shape (URLs derived). */
export function mediaDocToRecord(doc: Document, opts: MediaUrlOptions = {}) {
  const d = doc.data as Record<string, any>
  return {
    id: doc.rootId,
    filename: d.filename ?? '',
    original_name: d.originalName ?? d.filename ?? '',
    mime_type: d.mimeType ?? '',
    size: d.size ?? 0,
    width: d.width ?? null,
    height: d.height ?? null,
    folder: d.folder ?? 'uploads',
    r2_key: d.r2Key ?? '',
    public_url: deriveMediaPublicUrl(d.r2Key ?? '', opts),
    thumbnail_url: deriveMediaThumbnailUrl(d.r2Key ?? '', d.mimeType ?? '', opts),
    alt: d.alt ?? null,
    caption: d.caption ?? null,
    tags: Array.isArray(d.tags) ? d.tags : [],
    uploaded_by: doc.ownerId ?? doc.createdBy ?? null,
    uploaded_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

/** Map a media_asset document to the MediaFile view-model used by the media grid. */
export function mediaDocToFile(doc: Document, opts: MediaUrlOptions = {}) {
  const d = doc.data as Record<string, any>
  const mime = d.mimeType ?? ''
  const iso = new Date((doc.createdAt ?? 0) * 1000).toISOString()
  return {
    id: doc.rootId,
    filename: d.filename ?? '',
    original_name: d.originalName ?? d.filename ?? '',
    mime_type: mime,
    size: d.size ?? 0,
    public_url: deriveMediaPublicUrl(d.r2Key ?? '', opts),
    thumbnail_url: deriveMediaThumbnailUrl(d.r2Key ?? '', mime, opts) ?? undefined,
    alt: d.alt ?? undefined,
    caption: d.caption ?? undefined,
    tags: Array.isArray(d.tags) ? d.tags : [],
    uploaded_at: iso,
    fileSize: formatFileSize(d.size ?? 0),
    uploadedAt: iso,
    isImage: mime.startsWith('image/'),
    isVideo: mime.startsWith('video/'),
    isDocument: !mime.startsWith('image/') && !mime.startsWith('video/'),
  }
}

export interface MediaDeleteImpact {
  canHardDelete: boolean
  strongRefs: Array<{ fromDocumentId: string; fieldName: string }>
  weakRefs: Array<{ fromDocumentId: string; fieldName: string }>
}

export class MediaDocumentService {
  constructor(private db: D1Database, private tenantId = 'default') {}

  /** Create a media_asset document from R2 upload metadata. Published-on-create (immediately usable). */
  async createFromUpload(meta: MediaUploadMeta, createdBy?: string): Promise<Document> {
    const svc = new DocumentsService(this.db, { queryableFields: MEDIA_QUERYABLE, tenantId: this.tenantId, maxVersionsPerRoot: 5 })
    return svc.create(
      createDocumentSchema.parse({
        typeId: 'media_asset',
        tenantId: this.tenantId,
        locale: 'default',
        title: meta.originalName || meta.filename,
        data: {
          filename: meta.filename,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          size: meta.size,
          width: meta.width ?? null,
          height: meta.height ?? null,
          folder: meta.folder,
          r2Key: meta.r2Key,
          alt: meta.alt ?? '',
          caption: meta.caption ?? '',
          tags: meta.tags ?? [],
        },
        ownerId: createdBy ?? null,
        publishOnCreate: true,
      }),
      createdBy,
    )
  }

  /** Reference-aware delete: strong inbound references block hard-delete (offer archive instead). */
  async getDeleteImpact(mediaRootId: string): Promise<MediaDeleteImpact> {
    const refs = await new DocumentRepository(this.db, this.tenantId).getInboundReferences(mediaRootId)
    const strongRefs = refs.filter(r => r.refStrength === 'strong').map(r => ({ fromDocumentId: r.fromDocumentId, fieldName: r.fieldName }))
    const weakRefs = refs.filter(r => r.refStrength !== 'strong').map(r => ({ fromDocumentId: r.fromDocumentId, fieldName: r.fieldName }))
    return { canHardDelete: strongRefs.length === 0, strongRefs, weakRefs }
  }
}
