/**
 * TenantService — document-backed tenant registry for the multi-tenant plugin.
 *
 * Tenants are `type_id='tenant'` rows in `documents` (no dedicated table), exactly like the
 * plugin registry (`PluginService`). Tenant records are platform metadata, so the rows themselves
 * live under the 'default' tenant. Fast lookups use the generated columns `q_tenant_status` and
 * `q_tenant_domain` (registered in document-types-seed.ts).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { invalidateTenantCache } from '../../../../middleware/tenant'

export interface TenantData {
  /** Tenant id == document slug. */
  slug: string
  name: string
  domain: string | null
  status: 'active' | 'inactive'
  notes: string
  createdAt: number
  updatedAt: number
}

const TYPE_ID = 'tenant'
/** Tenant rows are platform metadata stored under the default tenant. */
const REGISTRY_TENANT = 'default'

export const DEFAULT_TENANT_SLUG = 'default'

/** Slugs that would collide with routing or platform conventions. */
export const RESERVED_TENANT_SLUGS = ['www', 'admin', 'api', 'auth', 'assets', 'static']

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function isValidTenantSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

export class TenantService {
  constructor(private db: D1Database) {}

  async listTenants(): Promise<TenantData[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM documents
      WHERE type_id = ? AND tenant_id = ? AND is_current_draft = 1 AND deleted_at IS NULL
      ORDER BY CASE WHEN slug = 'default' THEN 0 ELSE 1 END, title ASC
    `).bind(TYPE_ID, REGISTRY_TENANT).all()
    return (results || []).map(mapDocumentToTenant)
  }

  async getTenantBySlug(slug: string): Promise<TenantData | null> {
    const row = await this.db.prepare(`
      SELECT * FROM documents
      WHERE slug = ? AND type_id = ? AND tenant_id = ? AND is_current_draft = 1 AND deleted_at IS NULL
    `).bind(slug, TYPE_ID, REGISTRY_TENANT).first()
    return row ? mapDocumentToTenant(row) : null
  }

  async getTenantByDomain(host: string): Promise<TenantData | null> {
    const row = await this.db.prepare(`
      SELECT * FROM documents
      WHERE q_tenant_domain = ? AND type_id = ? AND tenant_id = ? AND is_current_draft = 1 AND deleted_at IS NULL
    `).bind(host.toLowerCase(), TYPE_ID, REGISTRY_TENANT).first()
    return row ? mapDocumentToTenant(row) : null
  }

  /**
   * Idempotently creates the 'default' tenant record so the registry always reflects the tenant
   * every pre-existing document belongs to.
   */
  async ensureDefaultTenant(): Promise<TenantData> {
    const existing = await this.getTenantBySlug(DEFAULT_TENANT_SLUG)
    if (existing) return existing
    return this.insertTenant({ name: 'Default', slug: DEFAULT_TENANT_SLUG, domain: null, notes: 'Built-in default tenant. All documents belong here until other tenants are used.' })
  }

  async createTenant(input: { name: string; slug: string; domain?: string | null; notes?: string }): Promise<TenantData> {
    const slug = input.slug.trim().toLowerCase()
    const name = input.name.trim()
    if (!name) throw new Error('Tenant name is required')
    if (!isValidTenantSlug(slug)) throw new Error('Slug must be lowercase letters, numbers and hyphens (max 63 chars)')
    if (slug === DEFAULT_TENANT_SLUG) throw new Error(`'${DEFAULT_TENANT_SLUG}' is the built-in tenant`)
    if (RESERVED_TENANT_SLUGS.includes(slug)) throw new Error(`'${slug}' is a reserved slug`)
    if (await this.getTenantBySlug(slug)) throw new Error(`A tenant with slug '${slug}' already exists`)

    const domain = normalizeDomain(input.domain)
    if (domain) {
      const owner = await this.getTenantByDomain(domain)
      if (owner) throw new Error(`Domain '${domain}' is already mapped to tenant '${owner.slug}'`)
    }

    return this.insertTenant({ name, slug, domain, notes: input.notes?.trim() ?? '' })
  }

  async updateTenant(slug: string, patch: { name?: string; domain?: string | null; status?: 'active' | 'inactive'; notes?: string }): Promise<TenantData> {
    const tenant = await this.getTenantBySlug(slug)
    if (!tenant) throw new Error('Tenant not found')
    if (slug === DEFAULT_TENANT_SLUG && patch.status === 'inactive') {
      throw new Error('The default tenant cannot be deactivated')
    }

    const name = patch.name !== undefined ? patch.name.trim() : tenant.name
    if (!name) throw new Error('Tenant name is required')
    const domain = patch.domain !== undefined ? normalizeDomain(patch.domain) : tenant.domain
    if (domain && domain !== tenant.domain) {
      const owner = await this.getTenantByDomain(domain)
      if (owner && owner.slug !== slug) throw new Error(`Domain '${domain}' is already mapped to tenant '${owner.slug}'`)
    }
    const status = patch.status ?? tenant.status
    const notes = patch.notes !== undefined ? patch.notes.trim() : tenant.notes

    const now = Math.floor(Date.now() / 1000)
    await this.db.prepare(`
      UPDATE documents
      SET data = json_set(data, '$.name', ?, '$.domain', ?, '$.status', ?, '$.notes', ?),
          title = ?, updated_at = ?
      WHERE slug = ? AND type_id = ? AND tenant_id = ? AND is_current_draft = 1 AND deleted_at IS NULL
    `).bind(name, domain, status, notes, name, now, slug, TYPE_ID, REGISTRY_TENANT).run()

    invalidateTenantCache()
    const updated = await this.getTenantBySlug(slug)
    if (!updated) throw new Error('Tenant not found')
    return updated
  }

  /**
   * Deletes a tenant record. Fail-closed: refuses the default tenant and any tenant that still
   * owns documents — the admin must move or erase the tenant's content first (no silent cascade).
   */
  async deleteTenant(slug: string): Promise<void> {
    if (slug === DEFAULT_TENANT_SLUG) throw new Error('The default tenant cannot be deleted')
    const tenant = await this.getTenantBySlug(slug)
    if (!tenant) throw new Error('Tenant not found')

    const docCount = await this.countDocumentsForTenant(slug)
    if (docCount > 0) {
      throw new Error(`Tenant '${slug}' still owns ${docCount} document(s). Delete or migrate its content first.`)
    }

    const now = Math.floor(Date.now() / 1000)
    await this.db.prepare(`
      UPDATE documents
      SET deleted_at = ?, updated_at = ?, is_current_draft = 0, is_published = 0
      WHERE slug = ? AND type_id = ? AND tenant_id = ? AND is_current_draft = 1
    `).bind(now, now, slug, TYPE_ID, REGISTRY_TENANT).run()

    invalidateTenantCache()
  }

  /** Live documents owned by the tenant (all types — content, media, plugin data, …). */
  async countDocumentsForTenant(slug: string): Promise<number> {
    const row = await this.db.prepare(
      'SELECT COUNT(*) as count FROM documents WHERE tenant_id = ? AND deleted_at IS NULL'
    ).bind(slug).first() as { count?: number } | null
    return row?.count ?? 0
  }

  private async insertTenant(input: { name: string; slug: string; domain: string | null; notes: string }): Promise<TenantData> {
    const docId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)
    const data = JSON.stringify({
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      status: 'active',
      notes: input.notes,
    })
    // R5: 17 columns / 9 ? / 8 literals — verified (mirrors PluginService.installPlugin)
    await this.db.prepare(`
      INSERT INTO documents (
        id, root_id, type_id, version_number, is_current_draft, is_published, status,
        parent_root_id, slug, title, tenant_id, locale, translation_group_id,
        data, metadata, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 1, 1, 1, 'published',
        '', ?, ?, ?, 'default', '',
        ?, '{}', ?, ?
      )
    `).bind(
      docId, docId, TYPE_ID,
      input.slug, input.name, REGISTRY_TENANT,
      data, now, now
    ).run()

    invalidateTenantCache()
    const created = await this.getTenantBySlug(input.slug)
    if (!created) throw new Error('Failed to create tenant')
    return created
  }
}

function normalizeDomain(domain: string | null | undefined): string | null {
  const trimmed = domain?.trim().toLowerCase() ?? ''
  return trimmed === '' ? null : trimmed
}

function mapDocumentToTenant(row: any): TenantData {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {})
  return {
    slug: row.slug,
    name: data.name || row.title || row.slug,
    domain: data.domain || null,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    notes: data.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
