/**
 * Multi-tenant plugin admin routes — mounted at /admin/tenants.
 *
 * Self-gated: routes mount statically (deactivation never unmounts routes), so every handler
 * checks the plugin's activation state and renders a notice page / 403 while inactive.
 */
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { D1Database, KVNamespace } from '@cloudflare/workers-types'
import { requireAuth } from '../../../../middleware/auth'
import { TENANT_COOKIE, MULTI_TENANT_PLUGIN_ID } from '../../../../middleware/tenant'
import { PluginService } from '../../../../services/plugin-service'
import { TenantService } from '../services/tenant-service'
import { renderTenantsList, renderTenantsInactive } from '../templates/tenants-list.template'
import { renderTenantForm } from '../templates/tenant-form.template'
import { renderTenantMembers } from '../templates/tenant-members.template'

type Bindings = { DB: D1Database; KV: KVNamespace }
type Variables = {
  user?: { userId: string; email: string; role: string; isSuperAdmin?: boolean; exp: number; iat: number }
  tenantId?: string
  appVersion?: string
}

const tenantFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(63).optional(),
  domain: z.string().max(253).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().max(2000).optional(),
})

function userShape(user: any) {
  return user ? { name: user.email, email: user.email, role: user.role } : undefined
}

function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  error.issues.forEach(e => {
    const f = String(e.path[0] ?? 'form')
    errors[f] = [...(errors[f] ?? []), e.message]
  })
  return errors
}

async function isMultiTenantActive(db: D1Database): Promise<boolean> {
  try {
    const plugin = await new PluginService(db).getPlugin(MULTI_TENANT_PLUGIN_ID)
    return plugin?.status === 'active'
  } catch {
    return false
  }
}

export function createTenantAdminRoutes(): Hono<{ Bindings: Bindings; Variables: Variables }> {
  const routes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

  routes.use('*', requireAuth())
  routes.use('*', async (c, next) => {
    const user = c.get('user')
    if (user?.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }
    return next()
  })

  // ─── Switch active tenant (sidebar switcher + list-page Switch buttons) ────
  routes.post('/switch', async (c) => {
    const db = c.env.DB
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)

    const form = await c.req.formData()
    const slug = String(form.get('tenant') ?? '').trim().toLowerCase()
    const redirect = String(form.get('redirect') ?? '')

    const svc = new TenantService(db)
    const tenant = await svc.getTenantBySlug(slug)
    if (!tenant || tenant.status !== 'active') {
      return c.json({ error: 'Unknown or inactive tenant' }, 400)
    }

    // Membership gate: a user may only switch into tenants they belong to ('default' is open).
    // Platform super-admins bypass the gate (access every tenant).
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    if (!user.isSuperAdmin && !(await svc.isMember(user.userId, slug))) {
      return c.json({ error: 'You are not a member of this tenant' }, 403)
    }

    setCookie(c, TENANT_COOKIE, slug, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 365,
    })

    const target = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/admin'
    return c.redirect(target)
  })

  // ─── Accept an invitation ─────────────────────────────────────────────────────
  // Registered before the /:slug routes so 'invitations' is never read as a tenant slug. The accept
  // is gated on the signed-in user's email matching the invited email (see acceptInvitation).
  routes.get('/invitations/accept', async (c) => {
    const db = c.env.DB
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    const user = c.get('user')
    if (!user) return c.redirect('/auth/login')
    const token = c.req.query('token') ?? ''
    try {
      const { slug } = await new TenantService(db).acceptInvitation(token, user.userId, user.email)
      return c.redirect(`/admin/tenants/${slug}/members?message=Invitation accepted`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation'
      return c.redirect(`/admin/tenants?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── List ───────────────────────────────────────────────────────────────────
  routes.get('/', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    if (!(await isMultiTenantActive(db))) {
      return c.html(renderTenantsInactive({ user: userShape(user), version }))
    }

    const svc = new TenantService(db)
    await svc.ensureDefaultTenant()
    const tenants = await svc.listTenants()

    const { results } = await db.prepare(
      'SELECT tenant_id, COUNT(*) as count FROM documents WHERE deleted_at IS NULL GROUP BY tenant_id'
    ).all()
    const counts = new Map((results ?? []).map((r: any) => [r.tenant_id, r.count as number]))

    const messageType = c.req.query('type') === 'error' ? 'error' as const : 'success' as const
    return c.html(renderTenantsList({
      tenants: tenants.map(t => ({ ...t, documentCount: counts.get(t.slug) ?? 0 })),
      currentTenantId: c.get('tenantId') ?? 'default',
      user: userShape(user),
      version,
      message: c.req.query('message'),
      messageType,
    }))
  })

  // ─── New form ───────────────────────────────────────────────────────────────
  routes.get('/new', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    if (!(await isMultiTenantActive(db))) {
      return c.html(renderTenantsInactive({ user: userShape(user), version }))
    }
    return c.html(renderTenantForm({ isEdit: false, user: userShape(user), version }))
  })

  // ─── Create ─────────────────────────────────────────────────────────────────
  routes.post('/', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)

    let formEntries: Record<string, unknown> = {}
    try {
      const form = await c.req.formData()
      formEntries = Object.fromEntries(form.entries())
      const validated = tenantFormSchema.parse(formEntries)
      if (!validated.slug) throw new z.ZodError([{ code: 'custom', message: 'Slug is required', path: ['slug'] }])

      const svc = new TenantService(db)
      await svc.createTenant({
        name: validated.name,
        slug: validated.slug,
        domain: validated.domain || null,
        notes: validated.notes,
      })
      // Auto-enroll the creator as the tenant 'admin' (a role name the document ACL understands) so
      // they get full per-tenant access and can immediately switch into / manage the tenant.
      if (user) await svc.addMember(validated.slug, user.userId, 'admin', user.email)
      return c.redirect('/admin/tenants?message=Tenant created successfully')
    } catch (error) {
      const tenant = { name: String(formEntries.name ?? ''), slug: String(formEntries.slug ?? ''), domain: String(formEntries.domain ?? ''), notes: String(formEntries.notes ?? '') }
      if (error instanceof z.ZodError) {
        return c.html(renderTenantForm({ isEdit: false, tenant, user: userShape(user), version, errors: zodToFieldErrors(error), message: 'Please correct the errors below', messageType: 'error' }))
      }
      const message = error instanceof Error ? error.message : 'Failed to create tenant'
      return c.html(renderTenantForm({ isEdit: false, tenant, user: userShape(user), version, message, messageType: 'error' }))
    }
  })

  // ─── Edit form ──────────────────────────────────────────────────────────────
  routes.get('/:slug/edit', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    if (!(await isMultiTenantActive(db))) {
      return c.html(renderTenantsInactive({ user: userShape(user), version }))
    }

    const tenant = await new TenantService(db).getTenantBySlug(c.req.param('slug'))
    if (!tenant) return c.redirect('/admin/tenants?message=Tenant not found&type=error')
    return c.html(renderTenantForm({ tenant, isEdit: true, user: userShape(user), version }))
  })

  // ─── Update ─────────────────────────────────────────────────────────────────
  routes.post('/:slug', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    const slug = c.req.param('slug')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)

    const svc = new TenantService(db)
    try {
      const form = await c.req.formData()
      const validated = tenantFormSchema.parse(Object.fromEntries(form.entries()))
      await svc.updateTenant(slug, {
        name: validated.name,
        domain: validated.domain || null,
        status: validated.status,
        notes: validated.notes,
      })
      return c.redirect('/admin/tenants?message=Tenant updated successfully')
    } catch (error) {
      const tenant = (await svc.getTenantBySlug(slug)) ?? { slug }
      if (error instanceof z.ZodError) {
        return c.html(renderTenantForm({ tenant, isEdit: true, user: userShape(user), version, errors: zodToFieldErrors(error), message: 'Please correct the errors below', messageType: 'error' }))
      }
      const message = error instanceof Error ? error.message : 'Failed to update tenant'
      return c.html(renderTenantForm({ tenant, isEdit: true, user: userShape(user), version, message, messageType: 'error' }))
    }
  })

  // ─── Delete ─────────────────────────────────────────────────────────────────
  routes.post('/:slug/delete', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)

    try {
      await new TenantService(db).deleteTenant(slug)
      return c.redirect('/admin/tenants?message=Tenant deleted successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete tenant'
      return c.redirect(`/admin/tenants?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── Members: list ────────────────────────────────────────────────────────────
  routes.get('/:slug/members', async (c) => {
    const db = c.env.DB
    const user = c.get('user')
    const version = c.get('appVersion')
    if (!(await isMultiTenantActive(db))) {
      return c.html(renderTenantsInactive({ user: userShape(user), version }))
    }
    const slug = c.req.param('slug')
    const svc = new TenantService(db)
    const tenant = await svc.getTenantBySlug(slug)
    if (!tenant) return c.redirect('/admin/tenants?message=Tenant not found&type=error')

    const [members, invitations] = await Promise.all([svc.listMembers(slug), svc.listInvitations(slug)])
    const messageType = c.req.query('type') === 'error' ? 'error' as const : 'success' as const
    return c.html(renderTenantMembers({
      slug, tenantName: tenant.name, members, invitations,
      user: userShape(user), version,
      message: c.req.query('message'), messageType,
    }))
  })

  // ─── Members: add by email ──────────────────────────────────────────────────────
  routes.post('/:slug/members', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    try {
      const form = await c.req.formData()
      const email = String(form.get('email') ?? '')
      const role = String(form.get('role') ?? 'viewer')
      await new TenantService(db).addMemberByEmail(slug, email, role)
      return c.redirect(`/admin/tenants/${slug}/members?message=Member added`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add member'
      return c.redirect(`/admin/tenants/${slug}/members?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── Members: change role ─────────────────────────────────────────────────────────
  routes.post('/:slug/members/:userId/role', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    const userId = c.req.param('userId')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    try {
      const form = await c.req.formData()
      const role = String(form.get('role') ?? '')
      await new TenantService(db).setMemberRole(slug, userId, role)
      return c.redirect(`/admin/tenants/${slug}/members?message=Role updated`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      return c.redirect(`/admin/tenants/${slug}/members?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── Members: remove ──────────────────────────────────────────────────────────────
  routes.post('/:slug/members/:userId/delete', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    const userId = c.req.param('userId')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    try {
      await new TenantService(db).removeMember(slug, userId)
      return c.redirect(`/admin/tenants/${slug}/members?message=Member removed`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member'
      return c.redirect(`/admin/tenants/${slug}/members?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── Invitations: create ──────────────────────────────────────────────────────
  routes.post('/:slug/invitations', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    const user = c.get('user')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    try {
      const form = await c.req.formData()
      const email = String(form.get('email') ?? '')
      const role = String(form.get('role') ?? 'viewer')
      await new TenantService(db).createInvitation(slug, email, role, user?.userId ?? null)
      return c.redirect(`/admin/tenants/${slug}/members?message=Invitation created`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create invitation'
      return c.redirect(`/admin/tenants/${slug}/members?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  // ─── Invitations: revoke ──────────────────────────────────────────────────────
  routes.post('/:slug/invitations/:id/revoke', async (c) => {
    const db = c.env.DB
    const slug = c.req.param('slug')
    const id = c.req.param('id')
    if (!(await isMultiTenantActive(db))) return c.json({ error: 'Multi-tenant plugin is not active' }, 403)
    try {
      await new TenantService(db).revokeInvitation(slug, id)
      return c.redirect(`/admin/tenants/${slug}/members?message=Invitation revoked`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke invitation'
      return c.redirect(`/admin/tenants/${slug}/members?message=${encodeURIComponent(message)}&type=error`)
    }
  })

  return routes
}
