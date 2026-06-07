# Enterprise Document Model POC — Implementation Runbook (v2)

> **This v2 supersedes the original greenfield plan.** The architecture in the original plan was sound and has **already been implemented (~90% scaffolded)** on branch `lane711/document-data-model` across all five original phases (schema, services, routes, admin UI, testimonials migration). The remaining work is **not** "build from scratch" — it is **fixing specific defects and finishing wiring**.
>
> This document is a **remediation runbook**. Every task names the exact `file:line`, the defect, the precise fix, *why* it matters (so it is not undone), and how to verify. The original architecture/design content is preserved verbatim in **Appendix A** as the authoritative reference.

---

## ⚠️ Cross-branch coordination (feature/better-auth-poc)

A separate large in-flight branch, `feature/better-auth-poc` (21 commits ahead of main; replaces auth with Better Auth + dynamic RBAC), **claims migrations 037–042** (`037_better_auth`, `038_dynamic_rbac`, `039_portal_access`, `040_rbac_permission_scopes`, `041_account_lockout`, `042_better_auth_plugins`). Decisions taken:

- **Do not merge better-auth into this branch.** Two large POCs in one branch is unreviewable; reconcile at main-integration time.
- **Document-repository migration renumbered `037 → 043`** (`043_document_repository.sql`) to avoid the hard collision. The migration is self-contained, so out-of-order application is safe in either merge order. All "037" mentions in the design sections below refer to this migration, now **043**.
- **Phase 2 (ACL) coupling is low and isolated:** better-auth keeps `Variables.user = { userId, email, role }`, which is exactly what the document ACL principal set needs. To future-proof the convergence, derive principals through a single helper `getPrincipalSet(c)` so the eventual richer RBAC (permission scopes) only changes that one function — never the per-route call sites.

## 0. How to use this document

1. **Read §1 "Implementation Rules" before touching any code.** Every recurring mistake in this codebase violates one of those 12 rules. They are the antidote to the thrashing.
2. Work the **Remediation Phases (§4)** in order. Phase 0 first — it contains data-loss and core-breaking blockers that make everything downstream untestable.
3. Each task has a stable **defect ID** (`D1`…`D28`). The **Defect Inventory (§3)** is the index; the phases are the ordered execution plan.
4. **Re-run the phase's verification gate before moving on.** Do not batch-fix across phases without verifying.
5. When a fix touches SQL, **count placeholders/columns/bind args by hand** (Rule 5). When a fix touches templates, **escape user input** (Rule 8). These two account for half the bugs.

---

## 1. Implementation Rules (non-negotiable)

These are not style preferences. Each line below is a rule a shipped bug already broke.

| # | Rule | Why / proven pattern |
|---|------|----------------------|
| **R1** | All document **writes** use raw `env.DB.prepare(sql).bind(...)` inside `env.DB.batch([...])`. **Never** put Drizzle query-builder objects (`db.update()`, `db.insert()`) in a batch. | Drizzle builders are not D1 `PreparedStatement`s. Proven raw-batch pattern: `routes/redirect.ts:243`, `services/event-tracking-service.ts:81`. The document services already do this correctly — keep it. |
| **R2** | Generated (`VIRTUAL`) columns and partial/expression UNIQUE indexes live **only** in raw migration `037`. Never declare them in `db/schema.ts` (Drizzle). | `drizzle-orm/sqlite-core` cannot express them. `schema.ts` correctly has **zero** document tables today. Keep the document layer raw-SQL. |
| **R3** | **Every** document read/write is tenant-scoped. Either go through `DocumentRepository` (it injects `this.tenantId`) or include `AND tenant_id = ?` in the SQL. No exceptions. | D1/SQLite has no row-level security; `tenant_id` is the only boundary. POC tenant is the literal `'default'`. |
| **R4** | Document **route handlers must not build raw document SQL.** Use `DocumentRepository`. (Legacy `content`/`collections` routes are exempt and out of scope; document routes are not.) | Single chokepoint = the only place `tenant_id` injection can be guaranteed. |
| **R5** | **Count before you commit any `INSERT`.** `# columns == # value-slots` in `VALUES`/`SELECT`, and `# of ?  ==  # of bind args`. A scalar subquery counts as one value-slot but contains its own `?`. | This is exactly the `saveDraft` bug (D1). Mock tests **cannot** catch it. |
| **R6** | `version_number` is derived in SQL: `(SELECT COALESCE(MAX(version_number),0)+1 FROM documents WHERE root_id = ?)`. **Never** compute it in JS. | Concurrent JS computation collides; the partial unique index `idx_documents_unique_version` would reject it. |
| **R7** | Derived rows (`document_facets`, `document_references`) exist **only** for the **current-draft** and **published** rows of a root. Delete them **explicitly** on supersede/unpublish — never rely on `ON DELETE CASCADE`. | D1 FK enforcement is not guaranteed on every path. This is also the golden-test invariant. |
| **R8** | **Escape every user-controlled value** rendered into HTML with `escapeHtml` from `utils/sanitize`. | Stored-XSS shipped in the testimonials templates (D17). |
| **R9** | After editing any `packages/core/migrations/*.sql`: run `cd packages/core && npm run generate:migrations`, **re-sync** the `my-sonicjs-app/migrations/` copies (keep byte-identical), and **commit** the regenerated `src/db/migrations-bundle.ts`. | Three migration mechanisms exist and have diverged before. |
| **R10** | Unit tests run on a **pure mock DB** (`vi.fn()`, `environment: 'node'`, **no SQLite**). They **cannot** verify SQL, constraints, `batch` atomicity, generated columns, or bind counts. Real coverage requires the `better-sqlite3` harness (Phase 1). **Do not claim a SQL behavior is "tested" from the mock suite.** | The mock even hardcodes `version_number = 2`. The D1 bug was invisible to it. |
| **R11** | New E2E specs are numbered **63+** (`tests/e2e/44-…` is already taken by `44-otp-login-admin.spec.ts`; highest existing is 62). | — |
| **R12** | The POC runs **alongside** legacy paths. **Do not drop legacy plugin tables** in the POC. | Original plan Non-Goal (Appendix A) + Phase 5 explicitly require the table-backed path to remain for rollback/comparison. |

---

## 2. As-Built Architecture (authoritative — reflects real files)

| File | Status | Notes |
|------|--------|-------|
| `packages/core/migrations/037_document_repository.sql` | ✅ Correct | All 5 tables, 10 VIRTUAL generated columns, all indexes + partial unique indexes. Faithful to design. Mirrored byte-identical in `my-sonicjs-app/migrations/`. |
| `packages/core/migrations/038_drop_testimonials.sql` | ❌ **Delete (D2)** | Bare `DROP TABLE testimonials` — data loss + plan divergence. |
| `packages/core/src/db/migrations-bundle.ts` | ⚠️ Regenerate | Generated artifact; currently dirty with timestamp-only churn (D20). |
| `services/document-repository.ts` | ✅ Good chokepoint | Tenant-scoped reads + `isAllowed` + keyset `listPublished`/`listDrafts`. **Needs filter/sort extension (D10).** Routes don't use it yet. |
| `services/documents.ts` | ⚠️ Core write path | `create`/`publish`/`unpublish`/`erase` correct. **`saveDraft` INSERT is broken (D1).** Write lookups miss `tenant_id` (D9). |
| `services/document-projection.ts` | ✅ Correct | Facet/ref materialization, 90-param chunking, `reindexType`. No changes needed. |
| `services/document-permissions.ts` | ⚠️ Resolver correct, unused | `isAllowed` precedence (deny→allow→base) is right but **never called by routes (D5)**; `baseGrantAllows` ignores user/group/token principals (D11). |
| `services/document-type-registry.ts` | ❌ Two bugs | Stores `schema` as constant `'{}'` (D4); hardcodes `is_system=0` (D12). |
| `services/document-types-seed.ts` | ✅ Good | 4 POC types; queryable fields + column names match `037` exactly. Uses `anyObject` passthrough schema (real validation deferred → D6). |
| `schemas/document.ts` | ✅ Good | `PluginDocumentType`/`QueryableField` match design; Zod `.issues` convention. |
| `routes/admin-documents.ts` | ⚠️ Mounted but bypassed | Raw SQL in handlers (D10), no `tenant_id` on writes (D9), no ACL (D5), dead validation line (D6), role-guard mismatch (D19). Its `/ui/*` routes are GET redirects only. |
| `routes/api-documents.ts` | ⚠️ Public, fail-open | Time-aware published reads, but **no ACL** (D5) and raw SQL (D10). |
| `routes/admin-content.ts` | ⚠️ Integration | Real document CRUD lives here under `/admin/content/documents/:typeId/...` (lines 1689–1840). Dead doc publish/unpublish list actions (D14); facet parse bug (D16); boolean parse bug (D15). |
| `routes/admin-testimonials.ts` | ⚠️ Document-backed | Dead unpublish (D3), filtered-count bug (D13), OFFSET pagination (D22). |
| `plugins/core-plugins/testimonials/index.ts` | ⚠️ Hard-cut | Repointed to documents (removed `addModel`). Dead unpublish (D3); API shape drift (D24). Needs feature-flag coexistence (Phase 5). |
| `templates/pages/admin-documents-form.template.ts` | ❌ Broken URLs | All action URLs point to the wrong path → 404 (D7); boolean (D15) & facet (D16) input bugs; duplicate HTMX (D18). |
| `templates/pages/admin-documents-list.template.ts` | ❌ Dead code | Zero callers (D8). |
| `templates/pages/admin-testimonials-*.template.ts` | ⚠️ XSS + style | Unescaped user input (D17); form uses old layout (style consistency). |
| `__tests__/services/documents.test.ts` | ⚠️ Theater | Pure-mock; proves nothing about SQL (D21). |
| `my-sonicjs-app/scripts/seed-documents.ts` | ✅ Demo seed | Inserts new demo docs via services. **Not** a backfill (D26). |
| `middleware/bootstrap.ts` | ✅ Correct | `bootstrapDocumentTypes(db)` runs after migrations; FK satisfied before writes. |

**Not yet built:** Media-as-document (original Phase 4), ACL admin UI, the E2E spec, the real-DB test harness.

---

## 3. Defect Inventory (index)

**CRITICAL — blocks the feature or loses data**

| ID | Area | Location | One-line |
|----|------|----------|----------|
| D1 | Write path | `services/documents.ts:182-200` | `saveDraft` INSERT: 30 cols / 29 values / 26 `?` / 27 binds → throws every call. |
| D2 | Migrations | `migrations/038_drop_testimonials.sql` + bundle | Bare `DROP TABLE testimonials`: silent data loss + violates "keep legacy path". |
| D3 | Testimonials | `admin-testimonials.ts:221-225`, `plugins/.../testimonials/index.ts:166-167` | Unpublish is dead code; unpublishing keeps serving the old published row forever. |
| D4 | Registry | `services/document-type-registry.ts:38` | `JSON.stringify(def.schema ? {} : {})` always stores `{}` → `schema_version` never bumps, `type_version` frozen at 1. |
| D5 | ACL | `routes/api-documents.ts`, `routes/admin-documents.ts` | `isAllowed` is never called → published docs served with no ACL (fail-open). |
| D6 | Validation | `routes/admin-documents.ts:240` | `(docType as any)._zodSchema?.safeParse(...)` references a nonexistent field; result discarded → arbitrary `data` accepted. |
| D7 | Admin UI | `templates/pages/admin-documents-form.template.ts:114-116,148,150,164,170,224,250,264` | All action URLs use `/admin/documents/ui/...`; real routes are `/admin/content/documents/...` → create/save/publish/unpublish/versions all 404. |
| D8 | Admin UI | `templates/pages/admin-documents-list.template.ts` (whole file) | Dead code (zero callers); Phase-3 generated-column filters/sorts never wired into the live list. |

**MAJOR — correctness / security / isolation**

| ID | Area | Location | One-line |
|----|------|----------|----------|
| D9 | Tenant isolation | `documents.ts:136,175,210,234,241,284,311`; `admin-documents.ts:282,313,339,365,375` | Write/lookup queries keyed only on `root_id`/`id` → cross-tenant write/leak. |
| D10 | Chokepoint | `admin-documents.ts:49-184`, `api-documents.ts:12-195` | Handlers build raw document SQL instead of using `DocumentRepository`. |
| D11 | ACL | `document-permissions.ts:42-58` | `baseGrantAllows` matches only `public`/`role`; a user-only principalSet fails closed. |
| D12 | Registry | `document-type-registry.ts:81` (INSERT), `:46-71` (UPDATE) | `is_system` hardcoded `0` despite `source:'system'`; `source` never updated on re-register. |
| D13 | Testimonials | `admin-testimonials.ts:88-107` | COUNT query ignores active filters → wrong total/pagination. |
| D14 | Admin UI | `admin-content.ts:332-334`, dangling comment `:1842-1846` | Publish/unpublish list actions for doc rows post to `content`-table endpoints → dead buttons. |
| D15 | Admin UI | `admin-documents-form.template.ts:36-41`, `admin-content.ts:1662` | Boolean fields can never be set `false` (unchecked checkbox sends nothing). |
| D16 | Admin UI | `admin-documents-form.template.ts:47-52`, `admin-content.ts:1666` | Single-value facet stored as string, not array (comma-sniffing). |
| D17 | Security | `admin-testimonials-list.template.ts:167,170,176`; `-form.template.ts:71,95,116,147` | Stored XSS: user fields rendered without `escapeHtml`. |
| D18 | Admin UI | `admin-documents-form.template.ts:259` | Duplicate HTMX `<script>` (layout already loads it, different version). |
| D19 | Auth | `admin-documents.ts:13` vs `app.ts:204-206` | Per-router `requireRole(['admin','editor'])` is overridden by global `requireRole(['admin'])` → editors locked out. |

**MINOR / STRUCTURAL / GAPS**

| ID | Area | Location | One-line |
|----|------|----------|----------|
| D20 | Migrations | `migrations-bundle.ts:4` | Timestamp-only working-tree churn. |
| D21 | Tests | `__tests__/services/documents.test.ts:13-109` | Pure-mock theater; no SQL/constraint/bind coverage (this is why D1/D3/D9 shipped). |
| D22 | Pagination | `admin-testimonials.ts:110-111` | Document-backed route uses forbidden `OFFSET`. |
| D23 | Data | `documents.ts:68` vs `admin-content.ts:848` | Timestamp unit split: documents = seconds, legacy content = ms. |
| D24 | API compat | `plugins/.../testimonials/index.ts:35-49` | Public JSON shape changed (camel/snake mix; `id` int→string). |
| D25 | Routing | `admin-documents.ts:187` | `GET /:id` must stay below literal routes; no guard comment. |
| D26 | Data | `seed-documents.ts` | No backfill of existing testimonial rows. |
| D27 | Admin UI | `admin-documents-form.template.ts:136` | Reference-kind fields silently excluded from the form (OK for now; document). |
| D28 | Admin UI | — | No ACL/role controls UI (Phase-3 bullet). |

---

## 4. Remediation Phases

> Run each phase's **Gate** before proceeding. Verification commands are in §5.

### Phase 0 — Unbreak the core & stop data loss — ✅ DONE

> Completed: D2 (038 removed from both dirs + bundle regenerated), D1 (`saveDraft` INSERT rebalanced to 30 cols / 27 `?` / 27 binds with a guard comment), D4 (registry persists `{queryableFields,settings}` so `schema_version` bumps), D20 (bundle regenerated, tops out at 037). Verified via `node:sqlite` round-trip + clean core type-check. Original task detail retained below for reference.

#### (original Phase 0 tasks)

**0.1 — D2: Remove the testimonials drop.**
- `rm packages/core/migrations/038_drop_testimonials.sql`
- `rm my-sonicjs-app/migrations/038_drop_testimonials.sql`
- `cd packages/core && npm run generate:migrations` (regenerates `src/db/migrations-bundle.ts` **without** the `'038'` entry).
- **Verify:** the regenerated bundle contains no `id: '038'` and no `DROP TABLE testimonials`.
- **Why:** `038` ran automatically at bootstrap (`migrations.ts` replays the bundle) and via `wrangler`, permanently destroying every `testimonials` row with no backfill. R12.

**0.2 — D1: Fix the `saveDraft` INSERT.** `services/documents.ts:182-200`.
The `INSERT INTO documents (… 30 columns …) SELECT …` supplies only **29** values: the trailing placeholder group has **20** `?` but needs **21** (columns `parent_root_id … updated_at`). It also binds **27** args against **26** `?`.
- **Fix (minimal, verified):** add exactly **one** `?` to the trailing group so the final `SELECT` line reads:
  ```
  1,0,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
  ```
  (21 `?`). After the fix the statement has: 5 leading `?` + 1 `version_number` subquery + 3 literals (`1,0,'draft'`) + 21 trailing `?` = **30 value-slots** and **27** `?`, matching the **27** bind args.
- **Stronger fix (recommended, less error-prone):** rewrite as `INSERT INTO documents (...) VALUES (..., (SELECT COALESCE(MAX(version_number),0)+1 FROM documents WHERE root_id = ?), ...)` with a 1:1 visual column↔value alignment, instead of `INSERT … SELECT … WHERE 1=1`.
- **Add a comment** above the statement stating the arithmetic (Rule R5) so it cannot silently regress.
- **Why:** D1 throws `Wrong number of parameter bindings` on every `saveDraft` — i.e. **editing any document is currently broken**. The mock tests can't see it (R10).

**0.3 — D4: Fix the registry schema/version bug.** `services/document-type-registry.ts:38`.
- Replace `const schemaJson = JSON.stringify(def.schema ? {} : {})` with:
  ```ts
  const schemaJson = JSON.stringify({ queryableFields: def.queryableFields ?? [], settings: def.settings ?? {} })
  ```
- **Why:** both ternary branches were `{}`, so `schemaChanged` (line ~43) compared `'{}'` to `'{}'` and `schema_version` **never** bumped — freezing `documents.type_version` at 1 and defeating idempotent schema-version stamping. A `z.ZodSchema` is not JSON-serializable, so persist the serializable shape instead.

**0.4 — D20: Clean the bundle churn.** After 0.1, commit the regenerated `migrations-bundle.ts`. (Optional: make `scripts/generate-migrations.ts` omit the volatile `Generated at:` timestamp so regeneration is deterministic.)

**Gate:** `cd packages/core && npm run type-check` passes • `npm run generate:migrations` produces a clean, committed bundle with no `038` • apply `037` to a local D1 and confirm a manual create→saveDraft→publish round-trip succeeds (`cd my-sonicjs-app && npm run setup:db`, then exercise via the API).

---

### Phase 1 — Real test harness + write/version/publish correctness — ✅ DONE

> Completed: D21 (`better-sqlite3` dev dep + `src/__tests__/utils/d1-sqlite.ts` D1 adapter applying migration 037; new `documents.sqlite.test.ts` with 7 real-SQL tests; mock `documents.test.ts` relabeled logic-only and its theater write-path tests removed), D9 (`DocumentsService` now takes `tenantId` and scopes every root/id lookup in saveDraft/publish/unpublish/softDelete/prune), D3 (dead unpublish fixed in `admin-testimonials.ts` and `plugins/.../testimonials/index.ts` — now acts on the root's published row). Full core suite: **1504 passed, 0 failed**; type-check clean. Regression tests cover D1, D3 (two-axis), D9, version monotonicity, the partial unique index, the golden reindex, and erase.
>
> Build the harness **first** in this phase: without it, every later fix is unverifiable (R10), and it is the thing that would have caught Phase 0's bugs.

**1.1 — D21: Add a real-SQLite test harness.**
- Add `better-sqlite3` as a dev dependency in `packages/core`.
- Add `packages/core/src/__tests__/services/documents.sqlite.test.ts` that: opens an in-memory `better-sqlite3` DB, applies migration `037` (read the `.sql` and execute), wraps it in a minimal D1-compatible adapter exposing `.prepare().bind().run()/.all()/.first()` and `.batch()`, and runs the document services against **real columns and indexes**.
- Keep the existing mock test file but **rename its describe block to "logic-only"** and stop treating it as SQL coverage.
- **Why:** This harness is the only thing that exercises generated columns, partial unique indexes, `batch` atomicity, and bind-count correctness.

**1.2 — D9: Tenant-scope all write/lookup paths.**
- Add `AND tenant_id = ?` (bind the repository's tenant, POC `'default'`) to: `documents.ts:136,175,210,234,241,284,311` and `admin-documents.ts:282,313,339,365,375`.
- **Preferred:** route these reads/writes through `DocumentRepository` methods so `this.tenantId` is the single injection point (R3/R4). At minimum, pass `tenantId` into `DocumentsService` (constructor) and use it in every lookup.
- **Why:** today a `saveDraft`/`publish`/`delete` can target another tenant's root. This is the acceptance-gate isolation requirement.

**1.3 — D3: Fix unpublish dead code (BOTH files).** `admin-testimonials.ts:221-225` and `plugins/core-plugins/testimonials/index.ts:166-167`.
- `saveDraft` always returns `isPublished = false` (`documents.ts:155`), so `&& newDraft.isPublished` can never be true. Look up the **currently-published row by root** and act on it:
  ```ts
  const pubRow = await db.prepare('SELECT id FROM documents WHERE root_id = ? AND is_published = 1 AND tenant_id = ?')
    .bind(rootId, 'default').first<{ id: string }>()
  if (validated.isPublished)      await svc.publish(newDraft.id, user?.userId)
  else if (pubRow)                await svc.unpublish(pubRow.id)
  ```
  (`svc.publish` already demotes the prior published row, so the publish branch needs no change.)
- **Why:** unchecking "Published" silently fails; the public API keeps serving the stale published version indefinitely.

**1.4 — Regression tests (against the new harness).** Add tests that would have failed before Phase 0/1:
- `saveDraft` persists a new version with correct `version_number` and **all** columns populated (catches D1).
- Publish→edit→saveDraft leaves the published row live; unpublish clears the live row (catches D3).
- Tenant A cannot `saveDraft`/`publish`/read tenant B's root (catches D9).
- `version_number` is monotonic; the partial unique indexes (`one_current_draft`, `one_published`, `unique_version`) reject violations.
- **Golden test:** incremental projection == `reindexType` rebuild (R7).

**Gate:** the real-DB suite passes and each Phase-0/1 fix has a failing-before/passing-after test.

---

### Phase 2 — Security: ACL wiring, principals, validation, XSS — 🟡 MOSTLY DONE

> Done: **D5 (public fail-open closed)** — `api-documents.ts` list + both single-doc reads now route through `isAllowed`; a single coupling helper `getDocumentRequestContext(c)` derives tenant + principal set (the one place better-auth's RBAC convergence will touch). Seed types `faq`/`testimonial`/`media_asset` now grant `public:['read']`; `contact_message` deliberately does not (PII stays hidden). **D11** — principal contract enforced in the helper + covered by tests. **D17** — testimonials templates escaped (XSS). **D19** — role-guard authority documented at `admin-documents.ts`. **D6** — deferred: removed the broken dead `_zodSchema` no-op, left a TODO (real per-type Zod validation is out of POC scope). 5 new real-DB ACL tests (deny-wins, no-public-grant denial, tenant-scoped overrides). Full suite **1509 passed**.
>
> **Phase 2b — DONE:** per-document `isAllowed` now gates every admin mutation in `admin-documents.ts` (create→`create`, saveDraft→`update`, publish/unpublish→`publish`, delete→`delete`, reindex→`manage`) via a `denyIfNotAllowed(c, db, rootId, permission, settings)` helper → 403 on deny. `create` uses an empty root (base-grant check). Test locks the create-base-grant semantics. Still on the global role guard only (not yet per-document ACL): the content-admin doc-backed mutation branches in `admin-content.ts` — lower priority since they share the same `/admin/*` `requireAuth`+`requireRole` gate.

**2.1 — D5: Wire `isAllowed` into routes.** The resolver in `document-permissions.ts`/`document-repository.ts` is correct but **never called**.
- **Public** (`api-documents.ts`): build `const repo = new DocumentRepository(db, 'default')` and `const principalSet = [{ type: 'public', id: '*' }]`.
  - List (`GET /`, line ~12): after mapping rows, drop any item where `await repo.isAllowed(principalSet, item.rootId, 'read', docType.settings)` is false **before** computing `nextCursor`.
  - Single (`GET /root/:rootId` ~140, `GET /:id` ~169): load `docType` via `new DocumentTypeRegistry(db).findById(row.type_id)`, and return `c.json({ error: 'Not found' }, 404)` when `isAllowed` is false.
- **Authed** (`admin-documents.ts`): `const user = c.get('user')`; `const principalSet = [{ type: 'user', id: user.userId }, { type: 'role', id: user.role }]`; gate read/create/update/publish/delete by the matching permission.
- **Why:** any `is_published = 1` document is currently served regardless of an explicit public `deny` — the fail-open the design forbids. Do **not** keep an `is_published`-only fast path.

**2.2 — D11: Principal contract for base grants.** `document-permissions.ts:42-58`.
- `baseGrantAllows` only honors `public` and `role`. **Document and enforce** that every authed caller's `principalSet` includes `{ type: 'role', id: <role> }` (done at the 2.1 call sites). Add a test: `isAllowedSync([{type:'user',id:'u1'}], [], 'read', { baseGrants: { editor: ['read'] } })` returns **false**.

**2.3 — D19: Resolve the role-guard contradiction.** `admin-documents.ts:13` vs `app.ts:204-206`.
- The global `app.use('/admin/*', requireRole(adminRoles))` (default `['admin']`) runs first and overrides the per-router `['admin','editor']`. Pick one source of truth: either remove line 13, or keep it **and** add a comment that the authoritative gate is `app.ts:205-206` and that hosts must set `config.adminAccessRoles` to include `'editor'`. Do not leave two contradicting lists.

**2.4 — D6: Real document-data validation (or explicit deferral).** `admin-documents.ts:240`.
- The current line references a nonexistent `_zodSchema` and discards the result. Either:
  - **Implement:** keep a module-level `Map<typeId, z.ZodSchema>` populated in `bootstrapDocumentTypes` (replace the `anyObject` passthrough in `document-types-seed.ts` with real per-type schemas). Look up by `input.typeId`, run `const r = schema.safeParse(input.data); if (!r.success) return c.json({ error: 'Validation failed', details: r.error.issues }, 400)` (use `.issues`, matching `auth.ts:247`).
  - **Or defer:** delete line 240 and add `// TODO(doc-model): validate data against registered type schema` — but do **not** leave broken dead code that looks like validation.

**2.5 — D12: Registry `is_system`/`source` correctness.** `document-type-registry.ts`.
- INSERT (`:81`): derive `is_system = def.source === 'system' ? 1 : 0` instead of the hardcoded `0`.
- UPDATE branch (`:46-71`): add `source = ?` to the `SET` list (currently `source` is insert-only and goes stale on re-register).

**2.6 — D17: Escape user input (XSS).**
- `admin-testimonials-list.template.ts`: `import { escapeHtml } from '../../utils/sanitize'` and wrap `author_name` (167), `author_title`/`author_company` (170), `testimonial_text`/truncated (176).
- `admin-testimonials-form.template.ts`: escape `authorName`/`authorTitle`/`authorCompany`/`testimonialText` rendered into `value="…"` (71,95,116,147).
- Pattern to copy: `admin-documents-form.template.ts` escapes every interpolated value.

**Gate:** restricted-doc test (public + authed) denies correctly; cross-tenant test passes; invalid `data` is rejected (if 2.4 implemented); a `<script>` in a testimonial renders inert.

---

### Phase 3 — Repository chokepoint + list / filter / sort — 🟡 MOSTLY DONE

> Done: **D10** — added `DocumentRepository.list()` (the single place document list SQL is built: status mode, generated-column scalar filters, facet join, sort, keyset cursor, schedule window, all tenant-scoped) with a `SAFE_IDENTIFIER` guard on interpolated column names; `listPublished`/`listDrafts` are now thin wrappers. Both `api-documents.ts` and `admin-documents.ts` list handlers now call `repo.list()` — **all inline list SQL removed from handlers** (R4). **D13** — `admin-testimonials.ts` count now shares one WHERE clause with the page query (no more phantom pages). **D22** — OFFSET documented as an intentional exception for the page-number admin HTML table (JSON APIs use keyset). **D8** — deleted the dead `admin-documents-list.template.ts` (zero importers). 5 new real-DB tests (scalar filter, facet join, sort, unsafe-identifier rejection, tenant scoping). Full suite **1514 passed**.
>
> Deferred to **Phase 3b**: surface the generated-column filter/sort *controls* in the rendered `/admin/content` doc-list UI (the data layer is done via `repo.list()` and exercised by the JSON admin API; this is HTML control wiring only).

**3.1 — D10: Extend the repository, route lists through it.** `document-repository.ts`.
- Add filter/sort options to `ListDocumentsOptions` and to `listPublished`/`listDrafts`:
  ```ts
  scalarFilters?: Array<{ column: string; value: string | number }>
  facetFilter?: { field: string; value: string }
  sortColumn?: string
  sortDir?: 'ASC' | 'DESC'
  ```
  Build the `AND <column> = ?` predicates and the `JOIN document_facets …` **inside the repository** (where `this.tenantId` is injected). **Whitelist** `column`/`sortColumn` against the type's `queryableFields` inside the repository — never let a raw user string reach SQL.
- Then make `admin-documents.ts GET /` and `api-documents.ts GET /` call these methods and **delete the inline `c.env.DB.prepare(...)` SQL** (R4). The column-whitelist logic the handlers do today (`admin-documents.ts:73-99`) moves into the repository.

**3.2 — D8: Resolve the dead list template + wire filters into the live list.**
- The live document list is `renderContentListPage` via `admin-content.ts GET /` doc branch (lines ~300-343), which only does `is_current_draft = 1` + hardcoded `LIKE` search.
- **Preferred:** `rm templates/pages/admin-documents-list.template.ts` and add generated-column filters/sorts to the content-list doc branch: read `filter[<field>]`, `facet[<field>]`, `sort`, `dir` query params, validate `<field>` against `docType.queryableFields`, and call the extended repository methods from 3.1. Surface the matching `<select>`/inputs in `renderContentListPage` for `doc:` models.
- (Alternative: actually mount `renderDocumentsListPage` from `admin-documents.ts:34` instead of redirecting, and fix its URLs as in Phase 4.) Either way, **do not leave the file as unreferenced dead code.**
- **Why:** Phase-3 acceptance is "filters use generated columns and facets, support multiple predicates at once."

**3.3 — D13: Fix the filtered count.** `admin-testimonials.ts:88-107`.
- Assemble the filter conditions + params **once** into a shared `whereClause`/`whereParams`; use it for **both** `SELECT COUNT(*)` and the data `SELECT`. Today the COUNT ignores the active filters, so totals/pagination are wrong whenever a filter is on.

**3.4 — D22: Pagination consistency.** `admin-testimonials.ts:110-111` uses `OFFSET`, which the design forbids for document reads.
- Convert to keyset on `(updated_at, id)` consistent with `admin-documents.ts`, **or** add a comment that the HTML page-number UI deliberately keeps `OFFSET` for template compatibility (an explicit, documented exception — not a silent one).

**Gate:** a multi-predicate filter (e.g. testimonial `rating >= 4 AND authorCompany = ?`) returns correct results through generated columns; a `tags` facet filter works; pagination total is correct under an active filter.

---

### Phase 4 — Admin UI correctness — ✅ DONE

> Done: **D7** — fixed all form-template action URLs (`/admin/documents/ui/…` → `/admin/content/documents/…`; breadcrumb/cancel/currentPath → `/admin/content`), so create/save/publish/unpublish/versions no longer 404. **D15** — hidden `false` input before each boolean checkbox so a boolean can be cleared. **D16** — `parseDocFormData` is now field-kind-aware: facet fields always parse to arrays (single values too). **D14** — document rows in the content list emit no list-level publish/unpublish actions (they're driven by the edit form); removed the stale "catch-all" comment. **D18** — removed the duplicate HTMX `<script>` (layout owns it). **D23** — documented the seconds-vs-ms timestamp split at the source + render sites. **D25** — guard comment keeping `GET /:id` below the literal routes. **D27** — documented the reference-field form exclusion. Type-check clean; full suite **1514 passed**.
>
> Deferred (cosmetic): migrate `admin-testimonials-form.template.ts` from the old `admin-layout-v2` to catalyst styling for visual consistency.

**4.1 — D7: Fix the form template URLs.** `templates/pages/admin-documents-form.template.ts`. Replace the base `/admin/documents/ui` with the **real** routes (verified in `admin-content.ts`):
- `formAction` (114-116): edit → `/admin/content/documents/${docType.id}/${doc.rootId}` (POST, route `:1760`); new → `/admin/content/documents/${docType.id}/new` (POST, route `:1698`).
- Publish (164): `/admin/content/documents/${docType.id}/${doc.id}/publish` (route `:1778`, keyed by `:documentId` — `doc.id` is correct).
- Unpublish (170): `/admin/content/documents/${docType.id}/${doc.id}/unpublish` (route `:1793`).
- Versions `hx-get` (250): `/admin/content/documents/${docType.id}/${doc.rootId}/versions` (route `:1825`).
- Breadcrumb/cancel/currentPath (148,150,224,264): **there is no `/admin/content/documents/:typeId` list route** — point these at the content list instead: `/admin/content?model=doc:${docType.id}`.

**4.2 — D14: Remove dead doc list actions.** `admin-content.ts:332-334`.
- Set `availableActions: []` for document rows (the list emits `root_id`-based ids, but the publish/unpublish handlers `:1778`/`:1793` require a version `:documentId`, and the promised catch-all at `:1842-1846` is an empty comment). Route publishing through the working edit form (4.1). Delete the misleading dangling comment block.

**4.3 — D15: Boolean round-trip.** `admin-documents-form.template.ts:36-41`.
- Emit a hidden input **before** the checkbox so a value is always submitted:
  ```html
  <input type="hidden" name="${name}" value="false">
  <input type="checkbox" name="${name}" value="true" ${strVal === 'true' ? 'checked' : ''}>
  ```
  `parseDocFormData` (`admin-content.ts:1662`) already maps `'true'`/`'false'`; no backend change needed.

**4.4 — D16: Facet array shape.** `admin-content.ts:1666` (`parseDocFormData`).
- Make parsing **field-kind-aware**: pass `docType.queryableFields` in and, for any field whose `kind === 'facet'`, always `data[field] = strVal.split(',').map(s => s.trim()).filter(Boolean)` — never decide array-ness by the presence of a comma (a single tag like `homepage` is currently stored as a string and won't index).

**4.5 — D18: Remove duplicate HTMX.** Delete `admin-documents-form.template.ts:259` (`<script src="…htmx.org@2.0.0…">`); the catalyst layout already loads HTMX.

**4.6 — D25 / D23 / D27: Guard comments.**
- D25: add `// /:id MUST stay below literal GET routes (/types, /ui) — see commit 5af9dea` above `admin-documents.ts:187`.
- D23: comment the timestamp units (`documents.ts:68` = seconds; `admin-content.ts:848` = ms) and ensure every `new Date(x)` on a document timestamp multiplies by 1000 (correct today at `admin-content.ts:331`, `admin-testimonials-list.template.ts:181`).
- D27: comment the reference-field exclusion at `admin-documents-form.template.ts:136` (fine for FAQ/testimonial; revisit for media references in Phase 6).
- **Style (optional):** migrate `admin-testimonials-form.template.ts` to `renderAdminLayoutCatalyst` + zinc inputs to match its sibling list and `admin-documents-form.template.ts`.

**Gate:** create, edit, publish, unpublish, and view version history for a **FAQ** and a **testimonial** entirely through the admin UI, with a boolean and a single-value facet round-tripping correctly.

---

### Phase 5 — Testimonials: feature-flag coexistence + backfill + API compat

> Phase 0 removed the destructive `038`. This phase makes testimonials a **proper** demonstration: document-backed **behind a flag**, with the legacy table retained (R12).

**5.1 — Feature flag.** Introduce a boolean (a `settings` row `testimonials.useDocumentModel` or env `DOCUMENTS_TESTIMONIALS`). In `createTestimonialPlugin()` and `admin-testimonials.ts`, branch: flag on → document path; flag off → original table-backed path. **Preserve the original `addModel()` + table queries on the off path** so the POC is reversible and A/B-comparable.

**5.2 — D26: Backfill script.** Add `my-sonicjs-app/scripts/backfill-testimonials.ts` (mirror `seed-documents.ts`): `getPlatformProxy()` → `DB`, `await bootstrapDocumentTypes(db)`, `SELECT * FROM testimonials`, and for each row `svc.create({ typeId:'testimonial', tenantId:'default', locale:'default', title: row.author_name, sortOrder: row.sort_order, data: { authorName: row.author_name, authorTitle: row.author_title, authorCompany: row.author_company, testimonialText: row.testimonial_text, rating: row.rating, sortOrder: row.sort_order } })` then `if (row.is_published) await svc.publish(doc.id)`. (`seed-documents.ts` only inserts new demo rows — it is **not** a backfill.)

**5.3 — D24: Public API shape compatibility.** `plugins/.../testimonials/index.ts:35-49` (`docToApiShape`).
- Confirm the pre-migration response keys via git history of the old plugin; emit **identical** keys (the current output mixes snake_case `author_*` with camelCase `isPublished`/`sortOrder`, and `id` changed from integer to string). Match the legacy shape, or document the breaking change explicitly.

**Gate:** with the flag on, testimonials list/create/edit/publish work via documents; with it off, the legacy table path works; deactivating the type preserves document rows; backfill reproduces existing rows as documents.

---

### Phase 6 — Remaining original scope + E2E + final acceptance

**6.1 — Media-as-document (original Phase 4).** 🟡 Foundation DONE: `services/media-documents.ts` — `MediaDocumentService.createFromUpload(meta)` creates a `media_asset` document (q_media_* generated columns + `tags` facet), `mediaDocToRecord`/`mediaDocToFile` adapters reproduce the legacy `media` row + `MediaFile` view-model with `public_url`/`thumbnail_url` **derived** from `r2Key` (payload omits them), and `getDeleteImpact()` does reference-aware delete (strong inbound refs block hard-delete). 5 real-DB tests. **Slices 1–2 DONE**:
- **Upload mirror** — BOTH upload paths (`api-media` single/bulk + the primary `admin-media` UI upload) mirror each upload into a `media_asset` document (best-effort dual-write; legacy `media` row still written so the library keeps working). Adapter default URL aligned to the library's `/files/<r2Key>` scheme.
- **Reference-aware delete** — the admin-media delete handler looks up the backing `media_asset` document by `r2Key` and **blocks hard-delete when it has strong inbound references** (offers archive instead).
- **Backfill** — `my-sonicjs-app/scripts/backfill-media.ts` mirrors existing `media` rows into documents (non-destructive, idempotent by `r2Key`).
- Tests: media service (5), api-media upload mirror (1), admin-media upload+delete-block (3).

**Remaining (slice 3)**: flip the library list/selector/search reads to documents via `mediaDocToFile` (then drop the legacy write), and resolve image-field references to roots-only.

**6.2 — D28: ACL admin UI (decide).** Either add a read-only base-grants display + per-document override form (POST to a new `/admin/content/documents/:typeId/:rootId/permissions` route writing `document_permissions` via the repository), or explicitly defer with a note. Do not silently drop the Phase-3 bullet.

**6.3 — E2E spec.** Add `tests/e2e/63-document-repository.spec.ts` (R11 — `44` is taken). Cover: admin creates an FAQ, publishes, edits while live, republishes; public API reads only the published revision; admin filters testimonials by `rating + authorCompany`; missing-required-field validation error; restricted doc hidden from an unauthorized user. Use `loginAsAdmin` and ensure `037` is applied to the local/preview D1 first.

**6.4 — Final acceptance** (original criteria, Appendix A): plugin-backed feature works without a dedicated table; published doc editable without going offline; per-document deny-wins over base grants; tenant isolation holds; PII erase across all versions; bounded version history; no column-cap pressure.

---

## Test coverage (as of this session)

- **Real-DB service tests** (`documents.sqlite.test.ts`, better-sqlite3 + migrations 043/044): create, saveDraft (D1 bind regression), two-axis publish/unpublish, tenant isolation (D9), version monotonicity + partial unique index, golden reindex, erase, ACL (deny-wins / base-grants / tenant-scoped / create base-grant), blog generated columns + `repo.list` filter/facet/sort, edit-while-published.
- **Route-integration tests** (mounted real routers + real SQLite + stubbed auth, runnable in vitest):
  - `admin-documents.integration.test.ts` — full document API CRUD + **Phase 2b ACL** (viewer 403, editor allowed).
  - `admin-content-docbacked.integration.test.ts` — **Option B** blog branches: create→documents, list, edit-form load, update+republish, status=draft→unpublish, **all-view union**.
- **E2E** (Playwright, run with `npm run e2e`): `63-document-blog-crud` (blog list renders; published doc on public API, draft hidden; **Option B create via the real content route**), `64-document-testimonials-admin` (mount fix: list renders + create via the real route).

Verified here: everything except the live browser/Worker (the two e2e specs need `npm run e2e` against the dev server).

## 5. Verification

Run from the repo **root** unless noted:

```bash
# Type safety (core)
cd packages/core && npm run type-check

# Unit + real-DB tests
npm test                      # root → @sonicjs-cms/core

# E2E (root only)
npm run e2e

# Local D1 with migrations applied (after any migration change)
cd my-sonicjs-app && npm run setup:db
```

After **any** `packages/core/migrations/*.sql` change: `cd packages/core && npm run generate:migrations`, re-sync `my-sonicjs-app/migrations/` copies (keep byte-identical), commit the regenerated `migrations-bundle.ts` (R9).

**Reminders the tooling will NOT catch for you:** D1's **100 bound params/statement** and **100 columns/table** limits do not reproduce on local SQLite — cover them with pure-logic unit tests (chunk counts, column budget). The unit mock DB executes no SQL — SQL/constraint/bind correctness is only proven by the Phase-1 `better-sqlite3` harness or a local-D1/E2E run (R10). CI currently has type-check commented out (`pr-tests.yml`) and skips E2E for forks — run them locally.

---

## 6. Suggested execution order & model/effort

- **Phase 0** is tiny and unblocks everything — do it first, verify, commit.
- **Phase 1** (real test harness) is the highest-leverage investment: it converts "Sonnet makes dumb mistakes" into "the harness catches them." Build it before the volume work in Phases 2–4.
- Model guidance: **Sonnet 4.6 / medium** for the mechanical fixes (Phases 0, 4, most of 3). **Sonnet 4.6 / high** for `db.batch`/SQL arithmetic (D1), ACL wiring (D5/D11), and the test harness (D21) — correctness-critical. Escalate to **Opus** only for a genuine design decision (e.g. whether to implement real per-type Zod validation now vs defer, or the media adapter contract). Default Sonnet, escalate per-task, not per-session.

---

# Appendix A — Original Design Reference (authoritative)

> The sections below are the original architectural design. They remain the source of truth for *why* the schema looks the way it does. Where the original "Implementation Phases" described greenfield work, the §4 Remediation Phases above supersede them.

## Overview

Build a SonicJS proof of concept for a small, production-capable document repository. The goal is not the absolute fewest tables. The goal is the fewest tables that can support an enterprise CMS long-term without turning query performance, permissions, schema introspection, references, and versioning into later rewrites.

The repository uses a small set of purpose-built tables plus indexed generated columns:

1. `document_types` — code/plugin registered schema definitions.
2. `documents` — all content, media metadata, plugin records, and historical versions. Queryable scalar fields are exposed as indexed JSON generated columns on this table (not a separate value table).
3. `document_references` — typed document-to-document edges with strong/weak semantics for relationship tracking and "where used".
4. `document_facets` — indexed rows for multi-valued scalar fields (e.g. `tags`), the one case generated columns cannot index.
5. `document_permissions` — per-document ACL overrides layered on top of type-level base grants.

This POC runs alongside the current `collections`, `content`, and plugin table system until the model is proven.

## Why generated columns instead of an EAV value table

Queryable *scalar* fields are indexed JSON generated columns on `documents` (`json_extract(data, '$.path')`): they cannot drift from the payload (engine-computed), require no backfill when added (`VIRTUAL`), and serve multi-field filters as ordinary `AND` predicates on one row. Multi-valued scalar fields (arrays like `tags`) use `document_facets`. References use `document_references` with a real foreign key. The trade-off to manage is the 100-columns-per-table limit; the graduation path is a per-type projection table rebuilt from `data` on write (reserved, not built).

## Versioning & Draft/Published Model

Versions live in `documents`, not a separate version table. "Newest revision" (`is_current_draft`) and "publicly served" (`is_published`) are **separate axes**, so a published document stays live while an editor works on a new draft. Each axis is DB-enforced to at most one per root via partial unique indexes. `status` (`draft`/`published`/`archived`) is a derived UI label. All multi-statement operations run as a single `env.DB.batch([...])`. `version_number` is derived in SQL. Derived rows exist only for the current-draft and published rows. Per-type `settings.maxVersionsPerRoot` (default ~50) bounds growth.

## Query Strategy

Direct reads by root ID, type, slug/path, status, hierarchy, recency, ownership. Published reads evaluate the schedule window (`scheduled_at`/`expires_at`) in SQL, tenant-scoped, with keyset cursor pagination on `(updated_at, id)` — never `OFFSET`. Scalar filters are `AND` predicates on generated columns; multi-valued filters JOIN `document_facets`; "where used" uses `document_references` (reverse lookup, restricted to live/relevant versions). `documents.data` remains canonical for rendering.

## Tenant Isolation

`tenant_id` is a column, not a security boundary by itself — D1/SQLite has no row-level security. All reads/writes go through the `DocumentRepository` chokepoint, which injects `tenant_id` from context; route handlers must not build raw SQL. `tenant_id` leads every list/filter index and is carried on references/facets/permissions. A cross-tenant leak test is an acceptance gate. Graduation path: database-per-tenant.

## Permissions Model

Two layers: base grants (type-level role defaults in `document_types.settings.baseGrants`) + per-document overrides in `document_permissions`. The effective decision is a single pure function, **deny wins → explicit allow → fall back to base grants** (empty ACL falls back to base grants). Public reads route through the same resolver as a `'public'` principal. CHECK constraints on `effect`/`principal_type`/`permission` eliminate typo-driven fail-open. `inherited` is a forward-compat flag (POC always writes `0`).

## PII and Right-to-Erasure

The **Contact Message** type stores `email`/`ipAddress`/`userAgent`. `erase(rootId)` hard-deletes all rows for the root in one batch — derived tables first (`document_facets`, `document_references`), then `document_permissions`, then every `documents` version row — and deletes any associated R2 object. Types holding PII set `settings.pii = true` and **erase hard; never archive**. Acceptance test: after `erase`, no table contains the subject's email/IP/user-agent across all versions.

## Candidate Document Types

- **Media Asset:** `filename, originalName, mimeType, size, width, height, folder, r2Key, alt, caption, tags[]`. Queryable: `mimeType`/`folder`/`size` (scalar), `tags` (facet). Do **not** enshrine `publicUrl`/`thumbnailUrl` — derive at read time.
- **FAQ:** `question, answer, category, sortOrder`. Queryable: `category`, `sortOrder` (scalar).
- **Testimonial:** `authorName, authorTitle, authorCompany, testimonialText, rating, sortOrder`. Queryable: `rating`, `authorCompany`, `sortOrder` (scalar).
- **Contact Message:** `name, email, message, ipAddress, userAgent, reviewStatus`. Queryable: `email`, `reviewStatus` (scalar). `pii: true`; inbound, never published (filter indexes scoped to `is_current_draft = 1`).

## Scale and Escape Hatches (D1 reality)

Single D1 DB capped (~10 GB), shared across tenants/versions/facets/refs/indexes — `maxVersionsPerRoot` makes "versions in `documents`" survivable. 100 bound params/statement and 100 columns/table are hard D1 limits not reproduced locally (enforce by chunking + tests). Read replication is off for the POC. Database-per-tenant and per-type projection tables are documented graduation paths, not built.

## Keep dedicated tables for

`users`, auth/session/token tables, `plugins`, `settings`, high-volume system/security logs, analytics events — anything with high write volume, protocol-specific constraints, append-only audit at scale, or operational ownership outside the document repository.
