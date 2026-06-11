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
- Remove dead `tenant` document type + `q_tenant_*` generated columns from `document-types-seed.ts`.

---

# Phase 2: per-tenant roles (G1) + super-admin (G2)

## Locked model
- Role/verb/grant **definitions** stay global (rbac_role/verb docs under 'default') — one platform role catalog.
- Role **assignment** is per-tenant:
  - `default` tenant → global `rbac_user_roles` doc (unchanged, back-compat).
  - tenant T ≠ default → `auth_tenant_member.role` holds the rbac role **name** the user has in T.
- `can(userId, resource, verb, tenantId)` resolves grants from the per-tenant role when T≠default, else global.
- **Super-admin (G2)** = explicit `auth_user.is_super_admin` flag (default 0). Bypasses membership gate +
  uses global roles in every tenant. NOT derived from the 'admin' role (admin's `*:manage` wildcard would
  make every admin a super-admin and re-open the gate). Opt-in only.

## G2 (super-admin) — build first (bounded)
1. `auth_user.is_super_admin INTEGER NOT NULL DEFAULT 0` (migration + schema + BA user additionalField input:false).
2. `app.ts`: carry `isSuperAdmin` on `c.get('user')` from BA session.user (no extra query).
3. `tenant.ts`: `enforceMembership = userPresent && pluginActive && !isSuperAdmin`.
4. switcher POST: bypass membership if super-admin.
5. Tests: e2e — super-admin switches into a non-member tenant (extends spec 71).

## G1 (per-tenant roles) — SHIPPED
Two-layer authorization (clean separation, no RBAC-core signature churn):
- **Global role** gates route *access* (`requireRole`/`requireRbac`) — can you enter the admin doc
  routes / platform sections at all. Unchanged.
- **Per-tenant role** gates the document *operation* (document ACL `baseGrants[role]`) — what you can
  do with content in the active tenant.

Implementation:
- `auth_tenant_member.role` holds a role name the document ACL understands (admin/editor/author/viewer).
  Tenant creator auto-enrolls as `admin` (was `owner`).
- `TenantService.listMemberRoles` / `getMemberRole`.
- `tenant.ts`: resolves the user's role in the active tenant onto `c.set('tenantRole')`
  (global role for 'default' / super-admins).
- `getDocumentRequestContext` (the single ACL coupling point) feeds `tenantRole` as the role principal —
  so the same user is admin in one tenant, viewer in another.

Verification: `tsc` clean · 32 MT unit tests (incl. per-tenant role CRUD) · e2e spec 72
(viewer-in-tenant denied create / allowed read / global admin create in default) · specs 70+71 green.

## G4 (member management UI) — SHIPPED
`/admin/tenants/<slug>/members` — add a user by email with a per-tenant role, change role inline,
remove. Lockout guards refuse demoting/removing the last admin.

- `TenantService`: `listMembers` (joined w/ auth_user), `addMemberByEmail`, `setMemberRole`,
  `removeMember`, `adminCount`; `VALID_MEMBER_ROLES` = admin/editor/author/viewer.
- Routes: GET/POST `/:slug/members`, POST `/:slug/members/:userId/role`, `/:slug/members/:userId/delete`.
- `tenant-members.template.ts` + a "Members" action on each tenant row.

Verification: `tsc` clean · 33 MT unit tests (incl. lockout guards) · e2e spec 73 (add/role/remove +
error) · specs 70/71/72 green.

## G3 (invitation flow) — SHIPPED
Invite an email to a tenant with a per-tenant role; the invitee joins by opening the accept link
while signed in with the invited email. On the members page (`/admin/tenants/<slug>/members`).

- `TenantService`: `createInvitation` (pending row, id = accept token, 7-day TTL), `listInvitations`,
  `revokeInvitation`, `acceptInvitation` (fail-closed: pending + non-expired + signed-in email must
  match the invited email — never token-only).
- Routes: POST `/:slug/invitations`, POST `/:slug/invitations/:id/revoke`, and
  GET `/invitations/accept?token=…` (registered before `/:slug` routes; `invitations` is a reserved slug).
- Invitations section on the members template (invite form + pending list w/ accept link + revoke).

Verification: `tsc` clean · 34 MT unit tests (full lifecycle + email-mismatch/expiry/duplicate/revoke
guards) · e2e spec 74 (invite→accept→member, revoke) · specs 70–73 green.

### Deferred
- **Email delivery** of the accept link — v1 surfaces the link in the admin UI (admin shares it).
  Wire the email plugin to send it (BA org endpoints / sendViaEmailPlugin).
- Shared/global (non-tenant) collections — G5.
- Optionally make `requireRbac` portal-section gates tenant-aware if any section should be per-tenant.
