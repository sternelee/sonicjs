# Wire tenant.ts → auth_tenant

Flip tenant registry source of truth from document-backed (`type_id='tenant'` rows) to the
Better Auth `auth_tenant` table (organization plugin). Greenfield only.

## Changes

1. **`0001_core.sql`** — add `status` / `domain` / `notes` columns to `auth_tenant` + domain index.
2. **`db/schema.ts`** — mirror new columns on `authTenant`.
3. **`auth/config.ts`** — `organization()` schema `additionalFields` for status/domain/notes so BA-native flows round-trip them.
4. **`TenantService`** — keep public API identical; swap storage `documents` → `auth_tenant`. Timestamps in **ms** (auth-table convention). `countDocumentsForTenant` still queries `documents.tenant_id` (content ownership unchanged).
5. **`middleware/tenant.ts`** — `loadTenantState()` reads `auth_tenant` instead of `type_id='tenant'` docs. Plugin-active gate unchanged (still doc-backed plugin registry).
6. **`tenant-service.sqlite.test.ts`** — assert against `auth_tenant` rows, drop `registerTenantType`.

## Not in scope (follow-ups)

- **Membership gate** — `auth_tenant_member` lookup in `resolveTenantSlug`/switcher so a user can only
  switch to tenants they belong to. (Security win; needs per-request user context.)
- Remove dead `tenant` document type + `q_tenant_*` generated columns from `document-types-seed.ts`.

## Review

Shipped. Tenant registry source of truth flipped documents → `auth_tenant`.

- `0001_core.sql`: `auth_tenant` gains `status`/`domain`/`notes` + `idx_auth_tenant_domain`. Bundle regen'd, app copy synced byte-identical (R9).
- `db/schema.ts`: `authTenant` mirrors columns.
- `auth/config.ts`: `organization()` schema `additionalFields` for the 3 fields.
- `TenantService`: internals → `auth_tenant` (raw SQL), public API unchanged → admin routes untouched. ms timestamps. `countDocumentsForTenant` still reads `documents.tenant_id`.
- `middleware/tenant.ts`: `loadTenantState()` reads `auth_tenant`.
- `tenant-service.sqlite.test.ts`: rewritten to assert `auth_tenant`.

Verification: `tsc` clean · 23 plugin unit tests pass · spec 70 (6 tests) pass · local D1 reset + reseeded.

Dead but harmless (cleanup follow-up): `tenant` document type + `q_tenant_status`/`q_tenant_domain`
generated columns still registered in `document-types-seed.ts` — no longer read.

### Membership gate (security) — SHIPPED
`auth_tenant_member` now gates tenant access for authed requests.

- `TenantService`: `listMemberSlugs` / `isMember` (default always allowed) / `addMember` (idempotent, `INSERT OR IGNORE`).
- `resolveTenantSlug(state, req, { memberSlugs, enforceMembership })`: when enforcing, every non-'default'
  candidate (header/cookie/domain/subdomain) must be in `memberSlugs`, else falls through → 'default'. No leak.
- `tenantMiddleware`: enforces only when `c.get('user')` present + plugin active (runs after session mw at app.ts:445).
  Anonymous/public requests stay ungated → public multi-tenant API/content serving unchanged.
- Switcher POST `/admin/tenants/switch`: 403 if not a member.
- Create route auto-enrolls the creator as `owner` (so they can immediately switch in — and so spec 70 stays green).
- Sidebar switcher dropdown filtered to member tenants.

Verification: `tsc` clean · 32 unit tests (resolver gate + membership CRUD) · spec 71 (5 tests) + spec 70 (6 tests) green.

### Deferred
- **Platform-operator bypass** (Payload's `userHasAccessToAllTenants`): no global super-admin override today —
  an admin only reaches tenants they're enrolled in. Add an opt-in bypass if a support/operator role needs all tenants.
- Remove dead `tenant` document type + `q_tenant_*` generated columns from `document-types-seed.ts`.
