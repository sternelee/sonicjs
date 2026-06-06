// @ts-nocheck
// Real-SQLite coverage (migration 037 applied) for the document write path.
// Unlike documents.test.ts (pure vi.fn() mock, logic-only), these tests execute actual SQL,
// so they catch bind/column/placeholder mismatches, constraint violations, batch atomicity,
// and generated-column behavior. Each test below maps to a Phase-0/1 defect (D1/D3/D9).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestD1 } from '../utils/d1-sqlite'
import { DocumentsService } from '../../services/documents'
import { DocumentProjection } from '../../services/document-projection'
import { DocumentRepository } from '../../services/document-repository'
import { DocumentPermissionsService } from '../../services/document-permissions'

const TST_FIELDS = [
  { name: 'rating', kind: 'scalar', type: 'integer', column: 'q_tst_rating' },
  { name: 'authorCompany', kind: 'scalar', type: 'text', column: 'q_tst_company' },
  { name: 'sortOrder', kind: 'scalar', type: 'integer', column: 'q_tst_sort_order' },
  { name: 'tags', kind: 'facet', type: 'text' },
]

function svc(db, tenantId = 'default') {
  return new DocumentsService(db, { queryableFields: TST_FIELDS, tenantId, typeSchemaVersion: 1 })
}

function count(db, sql, ...args) {
  return db.raw.prepare(sql).get(...args)
}

describe('DocumentsService — real SQLite (migration 037)', () => {
  let db
  beforeEach(() => {
    db = createTestD1()
    db.raw
      .prepare(
        `INSERT INTO document_types (id,name,display_name,schema,queryable_fields,settings,source,schema_version,is_system,is_active,created_at,updated_at)
         VALUES ('testimonial','testimonial','Testimonial','{}','[]','{}','system',1,1,1,1,1)`,
      )
      .run()
  })
  afterEach(() => db.close())

  it('create persists a row and computes generated columns + facets', async () => {
    const s = svc(db)
    const doc = await s.create(
      { typeId: 'testimonial', tenantId: 'default', title: 'Jane', data: { rating: 5, authorCompany: 'Acme', sortOrder: 1, tags: ['vip'] } },
      'u1',
    )
    expect(doc.versionNumber).toBe(1)
    expect(doc.isCurrentDraft).toBe(true)

    const row = db.raw.prepare('SELECT q_tst_rating r, q_tst_company c FROM documents WHERE id=?').get(doc.id)
    expect(row.r).toBe(5)
    expect(row.c).toBe('Acme')

    const facets = db.raw.prepare('SELECT value_text FROM document_facets WHERE document_id=? ORDER BY ordinal').all(doc.id)
    expect(facets.map((f) => f.value_text)).toEqual(['vip'])
  })

  it('D1 regression: saveDraft inserts v2 with all columns, merges data, demotes prev draft', async () => {
    const s = svc(db)
    const doc = await s.create({ typeId: 'testimonial', tenantId: 'default', title: 'Jane', data: { rating: 5, authorCompany: 'Acme', sortOrder: 1 } })

    // Pre-fix this threw (30 cols / 26 placeholders / 27 binds).
    const v2 = await s.saveDraft(doc.rootId, { data: { rating: 4 } })

    expect(v2.versionNumber).toBe(2)
    expect(v2.isCurrentDraft).toBe(true)
    expect(v2.data.rating).toBe(4)
    expect(v2.data.authorCompany).toBe('Acme') // merged from prev draft
    expect(count(db, 'SELECT COUNT(*) n FROM documents WHERE root_id=? AND is_current_draft=1', doc.rootId).n).toBe(1)
  })

  it('two-axis: saveDraft of a published doc keeps it live; publish moves the flag; unpublish clears it', async () => {
    const s = svc(db)
    const doc = await s.create({ typeId: 'testimonial', tenantId: 'default', data: { rating: 5 }, publishOnCreate: true })
    expect(doc.isPublished).toBe(true)

    const v2 = await s.saveDraft(doc.rootId, { data: { rating: 4 } })
    // v1 still published, v2 is the current draft and not published
    expect(db.raw.prepare('SELECT version_number FROM documents WHERE root_id=? AND is_published=1').get(doc.rootId).version_number).toBe(1)
    expect(v2.isPublished).toBe(false)

    const pubV2 = await s.publish(v2.id)
    expect(count(db, 'SELECT COUNT(*) n FROM documents WHERE root_id=? AND is_published=1', doc.rootId).n).toBe(1)
    expect(db.raw.prepare('SELECT version_number FROM documents WHERE root_id=? AND is_published=1').get(doc.rootId).version_number).toBe(2)

    await s.unpublish(pubV2.id)
    expect(count(db, 'SELECT COUNT(*) n FROM documents WHERE root_id=? AND is_published=1', doc.rootId).n).toBe(0)
  })

  it('D9: a service for tenant B cannot saveDraft tenant A’s root', async () => {
    const a = svc(db, 'tenantA')
    const doc = await a.create({ typeId: 'testimonial', tenantId: 'tenantA', data: { rating: 5 } })

    const b = svc(db, 'tenantB')
    await expect(b.saveDraft(doc.rootId, { data: { rating: 1 } })).rejects.toThrow()

    // Tenant A's root is untouched — no v2 leaked in.
    expect(count(db, 'SELECT COUNT(*) n FROM documents WHERE root_id=?', doc.rootId).n).toBe(1)
  })

  it('version_number is monotonic and the one-current-draft partial unique index is enforced', async () => {
    const s = svc(db)
    const doc = await s.create({ typeId: 'testimonial', tenantId: 'default', data: { rating: 5 } })
    await s.saveDraft(doc.rootId, { data: { rating: 4 } })
    await s.saveDraft(doc.rootId, { data: { rating: 3 } })

    const agg = count(db, 'SELECT MAX(version_number) m, COUNT(*) c FROM documents WHERE root_id=? AND is_current_draft=1', doc.rootId)
    expect(agg.m).toBe(3)
    expect(agg.c).toBe(1)

    // Forcing a second current draft must violate idx_documents_one_current_draft.
    const old = db.raw.prepare('SELECT id FROM documents WHERE root_id=? AND is_current_draft=0 LIMIT 1').get(doc.rootId)
    expect(() => db.raw.prepare('UPDATE documents SET is_current_draft=1 WHERE id=?').run(old.id)).toThrow(/UNIQUE/i)
  })

  it('golden: incremental projection == reindexType rebuild', async () => {
    const s = svc(db)
    const doc = await s.create({ typeId: 'testimonial', tenantId: 'default', data: { rating: 5, tags: ['a', 'b'] } })

    const before = db.raw.prepare('SELECT field_name, ordinal, value_text FROM document_facets WHERE document_id=? ORDER BY field_name, ordinal').all(doc.id)

    await new DocumentProjection(db).reindexType('testimonial', 'default', TST_FIELDS)

    const after = db.raw.prepare('SELECT field_name, ordinal, value_text FROM document_facets WHERE document_id=? ORDER BY field_name, ordinal').all(doc.id)
    expect(after).toEqual(before)
    expect(after.map((f) => f.value_text)).toEqual(['a', 'b'])
  })

  it('erase removes every version row and all derived rows for a root', async () => {
    const s = svc(db)
    const doc = await s.create({ typeId: 'testimonial', tenantId: 'default', data: { rating: 5, tags: ['x'] } })
    await s.saveDraft(doc.rootId, { data: { rating: 4 } })

    await s.erase(doc.rootId, 'default')

    expect(count(db, 'SELECT COUNT(*) n FROM documents WHERE root_id=?', doc.rootId).n).toBe(0)
    expect(count(db, 'SELECT COUNT(*) n FROM document_facets WHERE root_id=?', doc.rootId).n).toBe(0)
  })
})

describe('Document ACL — isAllowed against real document_permissions (D5/D11)', () => {
  let db
  beforeEach(() => { db = createTestD1() })
  afterEach(() => db.close())

  const PUBLIC_READ = { baseGrants: { public: ['read'], editor: ['read', 'update'] } }   // faq/testimonial/media
  const NO_PUBLIC = { baseGrants: { admin: ['read', 'manage'], editor: ['read'] } }        // contact_message (PII)

  it('public principal can read a type that grants public:[read]', async () => {
    const repo = new DocumentRepository(db, 'default')
    expect(await repo.isAllowed([{ type: 'public', id: '*' }], 'root1', 'read', PUBLIC_READ)).toBe(true)
  })

  it('public principal is denied a type with no public grant (contact_message stays hidden)', async () => {
    const repo = new DocumentRepository(db, 'default')
    expect(await repo.isAllowed([{ type: 'public', id: '*' }], 'root1', 'read', NO_PUBLIC)).toBe(false)
  })

  it('explicit public deny override hides a published-but-public type (deny wins)', async () => {
    const perms = new DocumentPermissionsService(db)
    await perms.grantPermission({ tenantId: 'default', rootId: 'root1', principalType: 'public', principalId: '*', permission: 'read', effect: 'deny' })
    const repo = new DocumentRepository(db, 'default')
    expect(await repo.isAllowed([{ type: 'public', id: '*' }], 'root1', 'read', PUBLIC_READ)).toBe(false)
  })

  it('an authed user matches role base grants only when the role principal is included (D11)', async () => {
    const repo = new DocumentRepository(db, 'default')
    expect(await repo.isAllowed([{ type: 'user', id: 'u1' }], 'root1', 'update', PUBLIC_READ)).toBe(false)
    expect(await repo.isAllowed([{ type: 'user', id: 'u1' }, { type: 'role', id: 'editor' }], 'root1', 'update', PUBLIC_READ)).toBe(true)
  })

  it('a deny override in tenant A does not affect resolution in tenant B', async () => {
    const perms = new DocumentPermissionsService(db)
    await perms.grantPermission({ tenantId: 'tenantA', rootId: 'root1', principalType: 'public', principalId: '*', permission: 'read', effect: 'deny' })
    const repoB = new DocumentRepository(db, 'tenantB')
    expect(await repoB.isAllowed([{ type: 'public', id: '*' }], 'root1', 'read', PUBLIC_READ)).toBe(true)
  })
})
