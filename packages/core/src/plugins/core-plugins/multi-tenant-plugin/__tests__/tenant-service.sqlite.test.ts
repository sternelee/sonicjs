// @ts-nocheck
// Real-SQLite coverage for the multi-tenant plugin's TenantService. Exercises actual SQL against
// the Better Auth `auth_tenant` table — slug/domain uniqueness, reserved slugs, the default-tenant
// guards, and the delete-blocked-while-owning-docs guard. Mock tests can't verify any of this (R10).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestD1 } from '../../../../__tests__/utils/d1-sqlite'
import { TenantService } from '../services/tenant-service'

describe('TenantService — real SQLite', () => {
  let db
  let svc
  beforeEach(async () => {
    db = createTestD1()
    svc = new TenantService(db)
  })
  afterEach(() => db.close())

  it('ensureDefaultTenant is idempotent and creates one active default row', async () => {
    const a = await svc.ensureDefaultTenant()
    const b = await svc.ensureDefaultTenant()
    expect(a.slug).toBe('default')
    expect(a.status).toBe('active')
    expect(b.slug).toBe('default')
    const rows = db.raw.prepare("SELECT COUNT(*) c FROM auth_tenant WHERE slug='default'").get()
    expect(rows.c).toBe(1)
  })

  it('createTenant persists row with status and normalized domain', async () => {
    const t = await svc.createTenant({ name: 'Acme Inc', slug: 'acme', domain: 'Acme.Example.com' })
    expect(t.slug).toBe('acme')
    expect(t.status).toBe('active')
    expect(t.domain).toBe('acme.example.com') // normalized lowercase

    const row = db.raw.prepare("SELECT status s, domain d FROM auth_tenant WHERE slug='acme'").get()
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

  it('membership: addMember enrolls a user; isMember/listMemberSlugs reflect it', async () => {
    // FK targets — a tenant row and a user row.
    await svc.createTenant({ name: 'Acme', slug: 'acme' })
    await svc.createTenant({ name: 'Beta', slug: 'beta' })
    db.raw.prepare(
      `INSERT INTO auth_user (id, email, first_name, last_name, created_at, updated_at)
       VALUES ('u1','u1@example.com','U','One',1,1)`
    ).run()

    expect(await svc.isMember('u1', 'acme')).toBe(false)
    // 'default' is always allowed without a row.
    expect(await svc.isMember('u1', 'default')).toBe(true)

    await svc.addMember('acme', 'u1', 'admin', 'u1@example.com')
    expect(await svc.isMember('u1', 'acme')).toBe(true)
    expect(await svc.isMember('u1', 'beta')).toBe(false)
    expect((await svc.listMemberSlugs('u1')).sort()).toEqual(['acme'])

    // Idempotent — second add does not duplicate (UNIQUE(tenant_id,user_id)).
    await svc.addMember('acme', 'u1', 'admin', 'u1@example.com')
    expect((await svc.listMemberSlugs('u1'))).toEqual(['acme'])

    // Per-tenant roles: admin in acme, viewer in beta (same user, different roles).
    await svc.addMember('beta', 'u1', 'viewer')
    expect((await svc.listMemberSlugs('u1')).sort()).toEqual(['acme', 'beta'])
    expect(await svc.getMemberRole('u1', 'acme')).toBe('admin')
    expect(await svc.getMemberRole('u1', 'beta')).toBe('viewer')
    expect(await svc.getMemberRole('u1', 'nope')).toBeNull()
    const roles = await svc.listMemberRoles('u1')
    expect(roles.get('acme')).toBe('admin')
    expect(roles.get('beta')).toBe('viewer')
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
