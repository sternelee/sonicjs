import type { Context } from 'hono'
import type { PrincipalRef } from '../schemas/document'

export interface DocumentRequestContext {
  tenantId: string
  principalSet: PrincipalRef[]
  userId: string | null
  role: string | null
}

/**
 * SINGLE coupling point between the document ACL layer and the auth/session shape.
 *
 * Every document route derives its tenant + principal set through this function and nowhere else.
 * When feature/better-auth-poc's richer RBAC (permission scopes, multiple roles/groups) lands, ONLY
 * this function changes — the per-route call sites stay the same. Today it reads the JWT-derived
 * `Variables.user = { userId, email, role }` that both the current auth and better-auth expose.
 *
 * - Anonymous request → the `public` principal (anonymous public reads still flow through isAllowed,
 *   so a published-but-restricted document can be hidden — no ACL-skipping fast path).
 * - Authenticated request → `[{ user }, { role }]`. Public is intentionally NOT added for authed
 *   users so a public `deny` override cannot clobber a role/user `allow`.
 */
/**
 * The tenant slug resolved for this request by tenantMiddleware. 'default' when the multi-tenant
 * plugin is inactive (single-tenant) or when no tenant could be resolved. Use this anywhere a route
 * or service needs the request tenant without the full principal set.
 */
export function getRequestTenant(c: Context): string {
  return (c.get('tenantId') as string | undefined) ?? 'default'
}

export function getDocumentRequestContext(c: Context): DocumentRequestContext {
  const user = c.get('user') as { userId?: string; role?: string } | undefined

  // Tenant is resolved per request by tenantMiddleware (header/cookie/subdomain when the
  // multi-tenant plugin is active, 'default' otherwise). This stays the one derivation place.
  const tenantId = (c.get('tenantId') as string | undefined) ?? 'default'

  if (!user?.userId) {
    return { tenantId, principalSet: [{ type: 'public', id: '*' }], userId: null, role: null }
  }

  // Per-tenant RBAC: tenantMiddleware resolves the user's role IN the active tenant onto
  // `tenantRole` (the global role for the 'default' tenant / super-admins). The document ACL is
  // keyed on this effective role, so the same user can be admin in one tenant and viewer in another.
  const role = (c.get('tenantRole') as string | undefined) ?? user.role ?? null

  const principalSet: PrincipalRef[] = [{ type: 'user', id: user.userId }]
  // baseGrantAllows only matches 'public' and 'role' principals, so the role MUST be included for
  // an authed user to match role-keyed base grants (D11).
  if (role) principalSet.push({ type: 'role', id: role })

  return { tenantId, principalSet, userId: user.userId, role }
}
