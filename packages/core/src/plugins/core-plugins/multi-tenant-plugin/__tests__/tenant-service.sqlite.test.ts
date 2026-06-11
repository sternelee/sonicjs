// @ts-nocheck
// Real-SQLite coverage for the multi-tenant plugin's TenantService. Exercises actual SQL — the
// `tenant` document type's generated columns (q_tenant_status/q_tenant_domain), slug/domain
// uniqueness, reserved slugs, the default-tenant guards, and the delete-blocked-while-owning-docs
// guard. Mock tests can't verify any of this (R10).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestD1 } from '../../../../__tests__/utils/d1-sqlite'
import { DocumentTypeRegistry } from '../../../../services/document-type-registry'
import { TenantService } from '../services/tenant-service'

async function registerTenantType(db) {
  const registry = new DocumentTypeRegistry(db)
  await registry.register({
    id: 'tenant',
    name: 'tenant',
    displayName: 'Tenant',
    source: 'system',
    schema: { parse: (x) => x },
    settings: { internal: true, maxVersionsPerRoot: 1, baseGrants: { admin: ['read', 'create', 'update', 'delete', 'manage'] } },
    queryableFields: [
      { name: 'status', kind: 'scalar', type: 'text', column: 'q_tenant_status' },
      { name: 'domain', kind: 'scalar', type: 'text', column: 'q_tenant_domain' },
    ],
  })
}

describe('TenantService — real SQLite', () => {
  let db
  let svc
  beforeEach(async () => {
    db = createTestD1()
    await registerTenantType(db)
    svc = new TenantService(db)
  })
  afterEach(() => db.close())

  it('ensureDefaultTenant is idempotent and creates one active default row', async () => {
    const a = await svc.ensureDefaultTenant()
    const b = await svc.ensureDefaultTenant()
    expect(a.slug).toBe('default')
    expect(a.status).toBe('active')
    expect(b.slug).toBe('default')
    const rows = db.raw.prepare("SELECT COUNT(*) c FROM documents WHERE type_id='tenant' AND slug='default' AND is_current_draft=1").get()
    expect(rows.c).toBe(1)
  })

  it('createTenant persists row and populates generated columns', async () => {
    const t = await svc.createTenant({ name: 'Acme Inc', slug: 'acme', domain: 'Acme.Example.com' })
    expect(t.slug).toBe('acme')
    expect(t.status).toBe('active')
    expect(t.domain).toBe('acme.example.com') // normalized lowercase

    const row = db.raw.prepare("SELECT q_tenant_status s, q_tenant_domain d FROM documents WHERE type_id='tenant' AND slug='acme'").get()
    expect(row.s).toBe('active')
    expect(row.d).toBe('acme.example.com')
  })

  it('getTenantByDomain matches on the normalized domain column', async () => {
    await svc.createTenant({ name: 'Acme', slug: 'acme', domain: 'acme.example.com' })
    const found = await svc.getTenantByDomain('ACME.example.com')
    expect(found?.slug).toBe('acme')
    expect(await svc.getTenantByDomain('nope.example.com')).toBeNull()
  })

  it('rejects invalid slugs, reserved slugs, and the default slug', async () => {
    await expect(svc.createTenant({ name: 'Bad', slug: 'Has Spaces' })).rejects.toThrow(/lowercase/)
    await expect(svc.createTenant({ name: 'Admin', slug: 'admin' })).rejects.toThrow(/reserved/)
    await expect(svc.createTenant({ name: 'Default', slug: 'default' })).rejects.toThrow(/built-in/)
  })

  it('rejects duplicate slug and duplicate domain', async () => {
    await svc.createTenant({ name: 'Acme', slug: 'acme', domain: 'acme.example.com' })
    await expect(svc.createTenant({ name: 'Acme 2', slug: 'acme' })).rejects.toThrow(/already exists/)
    await expect(svc.createTenant({ name: 'Beta', slug: 'beta', domain: 'acme.example.com' })).rejects.toThrow(/already mapped/)
  })

  it('updateTenant changes name/domain/status; refuses to deactivate default', async () => {
    await svc.ensureDefaultTenant()
    await svc.createTenant({ name: 'Acme', slug: 'acme' })
    const updated = await svc.updateTenant('acme', { name: 'Acme Corp', status: 'inactive', domain: 'acme.io' })
    expect(updated.name).toBe('Acme Corp')
    expect(updated.status).toBe('inactive')
    expect(updated.domain).toBe('acme.io')
    await expect(svc.updateTenant('default', { status: 'inactive' })).rejects.toThrow(/cannot be deactivated/)
  })

  it('listTenants returns default first then alphabetical', async () => {
    await svc.ensureDefaultTenant()
    await svc.createTenant({ name: 'Zeta', slug: 'zeta' })
    await svc.createTenant({ name: 'Alpha', slug: 'alpha' })
    const list = await svc.listTenants()
    expect(list.map((t) => t.slug)).toEqual(['default', 'alpha', 'zeta'])
  })

  it('deleteTenant refuses the default tenant', async () => {
    await svc.ensureDefaultTenant()
    await expect(svc.deleteTenant('default')).rejects.toThrow(/cannot be deleted/)
  })

  it('deleteTenant is blocked while the tenant owns documents, allowed once empty', async () => {
    await svc.createTenant({ name: 'Acme', slug: 'acme' })
    // Seed a content document owned by tenant 'acme'.
    db.raw.prepare(
      `INSERT INTO documents (id, root_id, type_id, version_number, is_current_draft, is_published, status,
        parent_root_id, slug, title, tenant_id, locale, translation_group_id, data, metadata, created_at, updated_at)
       VALUES ('d1','d1','blog_post',1,1,1,'published','','post-1','Post','acme','default','','{}','{}',1,1)`
    ).run()

    await expect(svc.deleteTenant('acme')).rejects.toThrow(/still owns 1 document/)
    expect(await svc.countDocumentsForTenant('acme')).toBe(1)

    // Soft-delete the doc, then deletion succeeds.
    db.raw.prepare("UPDATE documents SET deleted_at=2 WHERE id='d1'").run()
    expect(await svc.countDocumentsForTenant('acme')).toBe(0)
    await svc.deleteTenant('acme')
    expect(await svc.getTenantBySlug('acme')).toBeNull()
  })
})
