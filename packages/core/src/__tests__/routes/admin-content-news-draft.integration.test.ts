// @ts-nocheck
// Regression for the user-reported bug: "when i create new news document in draft, it was
// automatically published." News is NOT a seeded type — it becomes document-backed via
// autoRegisterCollectionDocumentTypes() (a doc type whose id == the collection name). This test
// drives the EXACT path: an auto-registered `news` type + the real admin-content POST route with
// the black "Save" button (action='save') and the Status dropdown on 'draft'. It must store a
// draft (is_published=0), never auto-publish.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { createTestD1 } from '../utils/d1-sqlite'
import { bootstrapDocumentTypes, autoRegisterCollectionDocumentTypes } from '../../services/document-types-seed'

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => async (_c: any, next: any) => next(),
  requireRole: () => async (_c: any, next: any) => next(),
}))

import adminContentRoutes from '../../routes/admin-content'

const NEWS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title', required: true },
    slug: { type: 'string', title: 'Slug', required: true },
    body: { type: 'string', title: 'Body' },
  },
  required: ['title', 'slug'],
})

function buildApp(db: any) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    ;(c as any).env = { DB: db }
    c.set('user', { userId: 'u1', email: 'a@b.c', role: 'admin', exp: 0, iat: 0 })
    c.set('appVersion', 'test')
    await next()
  })
  app.route('/admin/content', adminContentRoutes)
  return app
}

function form(obj: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(obj)) fd.append(k, v)
  return fd
}

describe('admin-content news (auto-registered doc type) — create-as-draft regression', () => {
  let db: any
  let app: any
  const COLL = 'news-coll'

  beforeEach(async () => {
    db = createTestD1()
    db.raw.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, first_name TEXT, last_name TEXT, role TEXT, is_active INTEGER, created_at INTEGER, updated_at INTEGER);
      CREATE TABLE collections (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, description TEXT, schema TEXT, is_active INTEGER DEFAULT 1, source_type TEXT, managed INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER);
      CREATE TABLE content (id TEXT PRIMARY KEY, collection_id TEXT, slug TEXT, title TEXT, data TEXT, status TEXT, published_at INTEGER, author_id TEXT, created_at INTEGER, updated_at INTEGER);
      CREATE TABLE content_fields (id TEXT PRIMARY KEY, collection_id TEXT, field_name TEXT, field_type TEXT, field_label TEXT, field_options TEXT, field_order INTEGER, is_required INTEGER, is_searchable INTEGER);
    `)
    db.raw.prepare("INSERT INTO users (id,email,username,first_name,last_name,role,is_active,created_at,updated_at) VALUES ('u1','a@b.c','admin','Ada','Lovelace','admin',1,1,1)").run()
    // A plain user collection named 'news' (source_type='user' → eligible for auto-registration).
    db.raw.prepare("INSERT INTO collections (id,name,display_name,description,schema,is_active,source_type,managed,created_at,updated_at) VALUES (?,?,?,?,?,1,'user',1,1,1)")
      .run(COLL, 'news', 'News', 'News items', NEWS_SCHEMA)
    await bootstrapDocumentTypes(db)
    const registered = await autoRegisterCollectionDocumentTypes(db) // registers the 'news' doc type
    expect(registered).toContain('news')
    app = buildApp(db)
  })
  afterEach(() => db.close())

  function createNews(slug: string, status: string, action: string) {
    return app.request('/admin/content', {
      method: 'POST',
      body: form({ collection_id: COLL, title: `News ${slug}`, slug, body: '<p>hi</p>', status, action }),
    })
  }

  it('black "Save" button + Status=draft → stored as DRAFT (is_published=0), not auto-published', async () => {
    const res = await createNews('breaking', 'draft', 'save')
    expect([200, 302]).toContain(res.status)
    const doc = db.raw.prepare("SELECT is_published, is_current_draft, status FROM documents WHERE type_id='news' AND slug='breaking'").get()
    expect(doc).toBeTruthy()
    expect(doc.is_published).toBe(0)
    expect(doc.is_current_draft).toBe(1)
    expect(doc.status).toBe('draft')
    // and nothing leaked to the legacy content table
    expect(db.raw.prepare("SELECT COUNT(*) n FROM content WHERE collection_id=?").get(COLL).n).toBe(0)
  })

  it('green "Save & Publish" button → published (this is the only path that should publish)', async () => {
    const res = await createNews('launch', 'draft', 'save_and_publish') // dropdown still 'draft', button forces publish
    expect([200, 302]).toContain(res.status)
    const doc = db.raw.prepare("SELECT is_published, status FROM documents WHERE type_id='news' AND slug='launch'").get()
    expect(doc.is_published).toBe(1)
  })
})
