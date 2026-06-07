// @ts-nocheck
// Real-SQLite tests for autoRegisterCollectionDocumentTypes — the step that makes EVERY content
// collection document-backed (so all content created via /admin/content is stored in `documents`).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestD1 } from '../utils/d1-sqlite'
import { bootstrapDocumentTypes, autoRegisterCollectionDocumentTypes } from '../../services/document-types-seed'
import { DocumentTypeRegistry } from '../../services/document-type-registry'

describe('autoRegisterCollectionDocumentTypes', () => {
  let db
  beforeEach(() => {
    db = createTestD1()
    db.raw.exec(
      `CREATE TABLE collections (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, is_active INTEGER DEFAULT 1, source_type TEXT, created_at INTEGER, updated_at INTEGER)`,
    )
    db.raw.prepare("INSERT INTO collections (id,name,display_name,is_active,source_type) VALUES ('n','news','News',1,NULL)").run()
    db.raw.prepare("INSERT INTO collections (id,name,display_name,is_active,source_type) VALUES ('p','pages','Pages',1,'user')").run()
    db.raw.prepare("INSERT INTO collections (id,name,display_name,is_active,source_type) VALUES ('f','contact_form','Contact Form',1,'form')").run()
    db.raw.prepare("INSERT INTO collections (id,name,display_name,is_active,source_type) VALUES ('x','archived_coll','Archived',0,NULL)").run()
  })
  afterEach(() => db.close())

  it('registers a document type for each active user collection (news, pages); excludes form-sourced + inactive', async () => {
    const registered = await autoRegisterCollectionDocumentTypes(db)
    expect(registered.sort()).toEqual(['news', 'pages'])

    const registry = new DocumentTypeRegistry(db)
    expect(await registry.findById('news')).toBeTruthy()
    expect(await registry.findById('pages')).toBeTruthy()
    expect(await registry.findById('contact_form')).toBeNull() // form-sourced excluded
    expect(await registry.findById('archived_coll')).toBeNull() // inactive excluded

    // news/pages get public:[read] base grants and no generated columns (CRUD-only).
    const news = await registry.findById('news')
    expect(news.settings.baseGrants.public).toContain('read')
    expect(news.queryableFields).toEqual([])
  })

  it('does not duplicate or overwrite an already-registered (hand-tuned) type', async () => {
    db.raw.prepare("INSERT INTO collections (id,name,display_name,is_active,source_type) VALUES ('b','blog_posts','Blog Posts',1,NULL)").run()
    await bootstrapDocumentTypes(db) // registers blog_posts with q_blog_* queryable fields

    const registered = await autoRegisterCollectionDocumentTypes(db)
    expect(registered).not.toContain('blog_posts') // already registered → skipped

    // blog_posts keeps its hand-tuned queryable fields (not flattened to []).
    const blog = await new DocumentTypeRegistry(db).findById('blog_posts')
    expect(blog.queryableFields.some(f => f.name === 'difficulty')).toBe(true)
  })

  it('no-ops when the collections table is absent', async () => {
    const freshDb = createTestD1() // no collections table
    const registered = await autoRegisterCollectionDocumentTypes(freshDb)
    expect(registered).toEqual([])
    freshDb.close()
  })
})
