// @ts-nocheck
// Real-SQLite tests for media-as-document (Phase 6): the media_asset create path, the legacy-shape
// compatibility adapters (URLs derived from r2Key), and reference-aware delete.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestD1 } from '../utils/d1-sqlite'
import { bootstrapDocumentTypes } from '../../services/document-types-seed'
import { DocumentsService } from '../../services/documents'
import {
  MediaDocumentService,
  mediaDocToRecord,
  mediaDocToFile,
  deriveMediaPublicUrl,
  deriveMediaThumbnailUrl,
} from '../../services/media-documents'

const META = {
  filename: 'hero.jpg',
  originalName: 'Hero.jpg',
  mimeType: 'image/jpeg',
  size: 123456,
  width: 1600,
  height: 900,
  folder: 'uploads',
  r2Key: 'uploads/hero.jpg',
  alt: 'Hero',
  tags: ['homepage'],
}

describe('media-as-document (Phase 6)', () => {
  let db
  beforeEach(async () => {
    db = createTestD1()
    await bootstrapDocumentTypes(db) // registers media_asset
  })
  afterEach(() => db.close())

  it('createFromUpload stores a media_asset doc with generated columns + tags facet', async () => {
    const doc = await new MediaDocumentService(db).createFromUpload(META, 'u1')
    expect(doc.typeId).toBe('media_asset')
    expect(doc.isPublished).toBe(true)

    const row = db.raw.prepare('SELECT q_media_mime m, q_media_folder f, q_media_size s FROM documents WHERE id=?').get(doc.id)
    expect(row.m).toBe('image/jpeg')
    expect(row.f).toBe('uploads')
    expect(row.s).toBe(123456)

    const facets = db.raw.prepare("SELECT value_text v FROM document_facets WHERE document_id=? AND field_name='tags'").all(doc.id)
    expect(facets.map(f => f.v)).toEqual(['homepage'])
  })

  it('adapter reproduces the legacy media row shape with derived URLs', () => {
    const doc = { rootId: 'r1', data: { ...META }, ownerId: 'u1', createdAt: 1000, updatedAt: 1000 }
    const rec = mediaDocToRecord(doc, { r2PublicHost: 'pub-x.r2.dev', imagesAccountId: 'acct1' })
    expect(rec.id).toBe('r1')
    expect(rec.original_name).toBe('Hero.jpg')
    expect(rec.mime_type).toBe('image/jpeg')
    expect(rec.r2_key).toBe('uploads/hero.jpg')
    expect(rec.public_url).toBe('https://pub-x.r2.dev/uploads/hero.jpg')
    expect(rec.thumbnail_url).toBe('https://imagedelivery.net/acct1/uploads/hero.jpg/thumbnail')
    expect(rec.tags).toEqual(['homepage'])
    expect(rec.uploaded_by).toBe('u1')
  })

  it('adapter reproduces the MediaFile view-model (fileSize, isImage)', () => {
    const doc = { rootId: 'r1', data: { ...META }, ownerId: 'u1', createdAt: 1000, updatedAt: 1000 }
    const file = mediaDocToFile(doc)
    expect(file.isImage).toBe(true)
    expect(file.isVideo).toBe(false)
    expect(file.isDocument).toBe(false)
    expect(file.fileSize).toBe('120.6 KB')
    expect(file.public_url).toBe('/media/uploads/hero.jpg') // no host configured → relative
  })

  it('thumbnail only for images with an Images account', () => {
    expect(deriveMediaThumbnailUrl('a/b.pdf', 'application/pdf', { imagesAccountId: 'x' })).toBeNull()
    expect(deriveMediaThumbnailUrl('a/b.jpg', 'image/jpeg', {})).toBeNull()
    expect(deriveMediaPublicUrl('a/b.jpg', {})).toBe('/media/a/b.jpg')
  })

  it('reference-aware delete: a strong inbound reference blocks hard-delete; weak does not', async () => {
    const mediaSvc = new MediaDocumentService(db)
    const media = await mediaSvc.createFromUpload(META, 'u1')

    // A live consumer document that references the media root.
    const consumer = await new DocumentsService(db, { tenantId: 'default' }).create(
      { typeId: 'faq', tenantId: 'default', data: { category: 'g' }, publishOnCreate: true },
      'u1',
    )

    // Distinct field_name per ref so they don't collide on idx_docref_unique(from_document_id,field_name,ordinal).
    const addRef = (strength) =>
      db.raw
        .prepare("INSERT INTO document_references (id,tenant_id,from_root_id,from_document_id,field_name,ordinal,to_root_id,ref_strength,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(`ref-${strength}`, 'default', consumer.rootId, consumer.id, `image_${strength}`, 0, media.rootId, strength, 1)

    addRef('weak')
    let impact = await mediaSvc.getDeleteImpact(media.rootId)
    expect(impact.canHardDelete).toBe(true)
    expect(impact.weakRefs).toHaveLength(1)

    addRef('strong')
    impact = await mediaSvc.getDeleteImpact(media.rootId)
    expect(impact.canHardDelete).toBe(false)
    expect(impact.strongRefs).toHaveLength(1)
  })
})
