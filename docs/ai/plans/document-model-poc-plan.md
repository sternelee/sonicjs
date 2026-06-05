# Enterprise Document Model POC Development Plan

## Overview

Build a SonicJS proof of concept for a small, production-capable document repository. The goal is not the absolute fewest tables. The goal is the fewest tables that can support an enterprise CMS long-term without turning query performance, permissions, schema introspection, references, and versioning into later rewrites.

The proposed repository uses a small set of purpose-built tables plus indexed generated columns:

1. `document_types` - code/plugin registered schema definitions.
2. `documents` - all content, media metadata, plugin records, and historical versions. **Queryable scalar fields are exposed as indexed JSON generated columns on this table** (not a separate value table).
3. `document_references` - typed document-to-document edges with strong/weak semantics for relationship tracking and "where used".
4. `document_facets` - indexed rows for multi-valued scalar fields (e.g. `tags`), the one case generated columns cannot index.
5. `document_permissions` - per-document ACL overrides layered on top of type-level base grants.

This mirrors the N2CMS item/detail/role lineage but modernizes it for JSON payloads, code-managed schemas, D1, R2 media, plugin registration, and Cloudflare-native query primitives.

This POC should run alongside the current `collections`, `content`, and plugin table system until the model is proven.

## Revision Notes (what changed from the first draft and why)

This plan supersedes an earlier draft whose query/reference layer was a single generic `document_values` Entity-Attribute-Value (EAV) table. The EAV design was replaced because, on Cloudflare D1/SQLite specifically, it imported three avoidable liabilities — write amplification (delete+reinsert N rows per save), the multi-predicate self-join problem (one JOIN per filter), and dual-write drift between `documents.data` and the derived rows — to buy flexibility the platform already provides natively. The major changes:

- **EAV `document_values` is removed.** Queryable *scalar* fields become **indexed JSON generated columns** on `documents` (`json_extract(data, '$.path')`). Multi-valued scalar fields (arrays like `tags`) move to a narrow, purpose-built `document_facets` table. Document references move to a dedicated `document_references` edge table with a real foreign key.
- **The draft/published axis is split from the "latest revision" axis.** A single `is_current` flag could not represent "edit a published document while it stays live" — the canonical editorial workflow. There are now two orthogonal, independently DB-enforced flags: `is_current_draft` and `is_published`.
- **Writes are atomic via `db.batch()`.** D1 has no interactive transactions; multi-statement version bumps must be a single batch.
- **Partial unique indexes are kept unconditionally.** The earlier "enforce in the service layer if local tooling struggles" escape hatch is removed — it was the only hard concurrency guarantee.
- **Tenant isolation, the permission algorithm, PII erasure, and forward-compat columns are specified up front** because they are cheap in the first migration and painful to retrofit.

## Goals

- Establish a finalized small schema that is viable for enterprise production use.
- Store most CMS and plugin records as typed documents instead of plugin-specific tables.
- Store media metadata as documents while keeping file bytes in Cloudflare R2.
- Support fast admin filtering/sorting over selected fields without per-plugin schema migrations, using native D1 primitives (generated columns + dense purpose-built side tables).
- Support references, "where used" lookups, and media/content relationship tracking with referential safety.
- Support per-document permissions, layered on type-level base grants, without embedding ACLs only in JSON.
- Enforce tenant isolation at a single chokepoint, not by developer discipline in each query.
- Keep dedicated tables only for platform infrastructure that genuinely needs them.

## Non-Goals

- Do not migrate existing production data in the POC.
- Do not remove existing migrations or plugin-specific tables during the first implementation.
- Do not replace auth/session/token tables with documents.
- Do not replace high-volume logs, analytics events, or queues with documents.
- Do not use R2 Data Catalog as the live operational backend.
- **Do not build full-text search in the POC.** Candidate types need typed filters (category, rating, MIME type), not free-text search. SQLite FTS5 adds write fan-out and storage pressure for a feature no POC goal requires. Full-text search is an explicit Non-Goal.
- **Do not build webhook delivery, cache-tag purge, external-index sync, scheduled-publish cron orchestration, per-type projection tables, an i18n fallback engine, read-replica session/bookmark plumbing, or a permission-history audit table in the POC.** Each is real enterprise work, but premature here. The schema reserves space for them (named hook points, forward-compat columns) so they are additive later, not rewrites.

## Schema Decision

A one-table JSON-only model is attractive, but it is too weak as the final production target.

Enterprise CMS use cases usually need:

- Admin list filters and sorts over arbitrary fields, often several at once.
- Stable schema/type introspection for generated forms and APIs.
- References between documents, such as media usage and related content, with safety before delete.
- Reverse lookups before delete/archive operations.
- Document-level permission overrides on top of role defaults.
- Historical versions without separate per-plugin version tables.
- Editing a published document without taking it offline.

The chosen model is the smallest durable baseline that satisfies these on Cloudflare D1:

- `documents.data` remains the canonical source of truth for full document payloads.
- **Queryable scalar fields are indexed generated columns derived from `documents.data`.** They cannot drift from the payload (the engine computes them), require no backfill when added (`VIRTUAL` columns), and serve multi-field filters as ordinary `AND` predicates on one row.
- **`document_references`** is a dense edge table for document-to-document relationships, with a foreign key, ordering, and strong/weak delete semantics.
- **`document_facets`** indexes multi-valued scalar fields (arrays), the one filtering case generated columns cannot serve with an index.
- **`document_permissions`** keeps per-document ACL overrides queryable and auditable; type-level base grants live in `document_types.settings`.
- **`document_types`** keeps schemas explicit instead of relying only on runtime imports.

### Why generated columns instead of an EAV value table

| Concern | EAV `document_values` (rejected) | Indexed generated columns (chosen) |
|---|---|---|
| Multi-field `AND` filter | One self-join per predicate, or `GROUP BY … HAVING COUNT` | Single indexed `WHERE` on one row |
| Write cost per save | Delete + reinsert N rows inside the write batch | Zero — engine-derived |
| Consistency with `data` | Dual-write; can drift; needs a reconciliation job | Structurally impossible to drift |
| Adding a queryable field | Backfill job over every existing row | `ALTER TABLE ADD COLUMN … VIRTUAL` (no backfill on D1) |
| Index shape | 5 sparse, mostly-NULL typed-value indexes | Dense per-field composite indexes, only for fields actually filtered |

D1/SQLite supports generated columns and partial/expression indexes natively. The trade-off to manage is the **100-columns-per-table limit**: generated columns accumulate across all types on the shared `documents` table. For the POC's handful of types this is comfortable. The graduation path when a type's queryable scalars would push the shared table toward the column cap is a **per-type projection table** rebuilt from `documents.data` on write — documented under "Scale and Escape Hatches", not built in the POC.

## Terminology

- **Document**: A typed record stored in `documents`, including content, media metadata, settings-like plugin records, and versions.
- **Document type**: A code/plugin registered schema stored in `document_types`.
- **Document data**: JSON payload in `documents.data`; this is the canonical full record data.
- **Queryable field**: A field declared by a document type as filterable/sortable. Materialized as a generated column (scalar), a `document_facets` row (multi-valued scalar), or a `document_references` row (document reference).
- **Document reference**: A `document_references` row whose `to_root_id` points to another document root.
- **Asset document**: A media document whose metadata lives in D1 and whose file bytes live in R2.
- **Root document**: The stable logical document ID (`root_id`) shared by all versions of a document.
- **Version row**: A row in `documents` with the same `root_id` as the original document.
- **Current draft**: The newest editable revision of a root (`is_current_draft = 1`). At most one per root.
- **Published revision**: The revision currently served to the public (`is_published = 1`). At most one per root. May be the same row as the current draft, or an older row while a newer draft is in progress.

## Core Schema

Create one migration for the document repository tables.

```sql
CREATE TABLE document_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  schema TEXT NOT NULL,                        -- JSON: serialized field schema for introspection/forms
  queryable_fields TEXT NOT NULL DEFAULT '[]', -- JSON: declared queryable field config (drives columns/facets/refs)
  settings TEXT NOT NULL DEFAULT '{}',          -- JSON: base ACL grants, retention policy, PII flags, etc.
  plugin_id TEXT,
  source TEXT NOT NULL DEFAULT 'code' CHECK (source IN ('code', 'plugin', 'system')),
  schema_version INTEGER NOT NULL DEFAULT 1,    -- bumped on schema change; stamped onto documents.type_version
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL,
  type_id TEXT NOT NULL REFERENCES document_types(id),
  type_version INTEGER NOT NULL DEFAULT 1,      -- schema_version this row was written against

  -- Revision chain. The first version uses root_id = id.
  version_of_id TEXT REFERENCES documents(id),
  version_number INTEGER NOT NULL DEFAULT 1,

  -- Two orthogonal state axes (Payload/Strapi _status model). Each is DB-enforced to at most one per root.
  -- is_current_draft: the newest editable revision.
  -- is_published:     the revision currently served publicly.
  -- A freshly published doc with no newer draft has both = 1 on the same row.
  is_current_draft INTEGER NOT NULL DEFAULT 1,
  is_published INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Hierarchy and routing.
  parent_root_id TEXT NOT NULL DEFAULT '',
  slug TEXT,
  path TEXT,
  title TEXT,
  zone TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,

  -- Lifecycle.
  published_at INTEGER,
  scheduled_at INTEGER,
  expires_at INTEGER,
  deleted_at INTEGER,

  -- Partitioning and localization. Defaults keep single-tenant installs simple.
  tenant_id TEXT NOT NULL DEFAULT 'default',
  locale TEXT NOT NULL DEFAULT 'default',
  translation_group_id TEXT NOT NULL DEFAULT '', -- links locale variants of the same logical content

  -- Canonical payload and extra system metadata.
  data TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',

  -- Ownership and audit fields. Soft references to users(id), validated at the repository layer.
  -- No DB-level FK: migration 037 must not couple to the auth schema's presence or PK name, and
  -- D1 foreign-key enforcement is not guaranteed on every execution path.
  owner_id TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE document_references (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_root_id TEXT NOT NULL,
  from_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,                      -- declared queryable field name (same identity used by facets)
  ordinal INTEGER NOT NULL DEFAULT 0,
  to_root_id TEXT NOT NULL,                      -- targets a logical root, not a documents.id; no DB FK (see References note)
  ref_strength TEXT NOT NULL DEFAULT 'weak' CHECK (ref_strength IN ('strong', 'weak')),
  created_at INTEGER NOT NULL
);

CREATE TABLE document_facets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  root_id TEXT NOT NULL,
  type_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  value_text TEXT,
  value_number REAL,                            -- populated for numeric facet fields; text facets leave it NULL
  created_at INTEGER NOT NULL
);

CREATE TABLE document_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  root_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'role', 'group', 'public', 'token')),
  principal_id TEXT NOT NULL,                   -- '*' for the public principal
  permission TEXT NOT NULL CHECK (permission IN ('read', 'create', 'update', 'delete', 'publish', 'manage')),
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  inherited INTEGER NOT NULL DEFAULT 0,         -- reserved for future ancestor-based ACL propagation; POC writes 0
  created_at INTEGER NOT NULL,
  created_by TEXT                                -- soft reference to users(id), validated at the repository layer
);
```

### Queryable scalar fields as generated columns

Queryable scalar fields are exposed as indexed generated columns on `documents`, derived from `data`. For the POC's candidate types these are hand-written in migration 037 (do not build `ALTER TABLE` codegen in the registry yet — it is migration-ordering-sensitive machinery best deferred):

```sql
-- FAQ
ALTER TABLE documents ADD COLUMN q_faq_category    TEXT    AS (json_extract(data, '$.category'))  VIRTUAL;
ALTER TABLE documents ADD COLUMN q_faq_sort_order  INTEGER AS (json_extract(data, '$.sortOrder')) VIRTUAL;

-- Testimonial
ALTER TABLE documents ADD COLUMN q_tst_rating      INTEGER AS (json_extract(data, '$.rating'))        VIRTUAL;
ALTER TABLE documents ADD COLUMN q_tst_company     TEXT    AS (json_extract(data, '$.authorCompany')) VIRTUAL;
ALTER TABLE documents ADD COLUMN q_tst_sort_order  INTEGER AS (json_extract(data, '$.sortOrder'))     VIRTUAL;

-- Contact Message
ALTER TABLE documents ADD COLUMN q_msg_review      TEXT    AS (json_extract(data, '$.reviewStatus')) VIRTUAL;
ALTER TABLE documents ADD COLUMN q_msg_email       TEXT    AS (json_extract(data, '$.email'))        VIRTUAL;

-- Media Asset (scalars; tags are multi-valued and handled by document_facets)
ALTER TABLE documents ADD COLUMN q_media_mime      TEXT    AS (json_extract(data, '$.mimeType')) VIRTUAL;
ALTER TABLE documents ADD COLUMN q_media_folder    TEXT    AS (json_extract(data, '$.folder'))   VIRTUAL;
ALTER TABLE documents ADD COLUMN q_media_size      INTEGER AS (json_extract(data, '$.size'))     VIRTUAL;
```

Notes:

- `VIRTUAL` columns store nothing; only their indexes consume space. They can be added by `ALTER TABLE` with no row backfill — this is how new queryable fields are introduced later without a migration over existing data.
- `STORED` columns are computed once at write and avoid per-read `json_extract`, but on D1/SQLite **`STORED` columns cannot be added via `ALTER TABLE`** — only declared at `CREATE TABLE`. Policy: if a hot field is known at 037 time and read-heavy, declare it `STORED` in the original `CREATE TABLE`; everything added later is `VIRTUAL`.
- Column naming uses a short per-type prefix (`q_faq_`, `q_tst_`, …) to stay legible and avoid collisions across types on the shared table.

Recommended indexes:

```sql
CREATE INDEX idx_document_types_plugin ON document_types(plugin_id);
CREATE INDEX idx_document_types_active ON document_types(is_active);

-- Revision chain
CREATE INDEX idx_documents_root ON documents(root_id, version_number DESC);

-- List / lifecycle (tenant_id leads every list index for isolation and selectivity)
CREATE INDEX idx_documents_published ON documents(tenant_id, type_id, locale, is_published)
  WHERE is_published = 1 AND deleted_at IS NULL;
CREATE INDEX idx_documents_drafts ON documents(tenant_id, type_id, status, is_current_draft)
  WHERE is_current_draft = 1;
CREATE INDEX idx_documents_parent ON documents(tenant_id, parent_root_id, sort_order, is_published);
CREATE INDEX idx_documents_path ON documents(tenant_id, path);
CREATE INDEX idx_documents_translation ON documents(translation_group_id, locale);
CREATE INDEX idx_documents_deleted ON documents(deleted_at);
CREATE INDEX idx_documents_scheduled ON documents(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_documents_expires ON documents(expires_at) WHERE expires_at IS NOT NULL;

-- Stable keyset/cursor pagination for published lists: order by (updated_at DESC, id DESC)
CREATE INDEX idx_documents_published_cursor
  ON documents(tenant_id, type_id, updated_at DESC, id DESC)
  WHERE is_published = 1 AND deleted_at IS NULL;

-- Generated-column filter indexes (one per filterable scalar; the sort key trails the filter key so a
-- filtered list returns already-ordered rows from one index).
CREATE INDEX idx_q_faq_category ON documents(tenant_id, type_id, q_faq_category, q_faq_sort_order) WHERE is_published = 1;
CREATE INDEX idx_q_tst_rating   ON documents(tenant_id, type_id, q_tst_rating, q_tst_sort_order)   WHERE is_published = 1;
CREATE INDEX idx_q_tst_company  ON documents(tenant_id, type_id, q_tst_company, q_tst_sort_order)  WHERE is_published = 1;
CREATE INDEX idx_q_media_mime   ON documents(tenant_id, type_id, q_media_mime)   WHERE is_published = 1;
CREATE INDEX idx_q_media_folder ON documents(tenant_id, type_id, q_media_folder) WHERE is_published = 1;
CREATE INDEX idx_q_media_size   ON documents(tenant_id, type_id, q_media_size)   WHERE is_published = 1;
-- Contact Message is a draft-only inbound type (never published); filter on the current draft.
CREATE INDEX idx_q_msg_review   ON documents(tenant_id, type_id, q_msg_review) WHERE is_current_draft = 1;
CREATE INDEX idx_q_msg_email    ON documents(tenant_id, type_id, q_msg_email)  WHERE is_current_draft = 1;

-- References
CREATE INDEX idx_docref_to   ON document_references(tenant_id, to_root_id);
CREATE INDEX idx_docref_from ON document_references(from_document_id);

-- Facets (multi-valued scalar lookup, e.g. tags contains 'homepage')
CREATE INDEX idx_facets_lookup ON document_facets(tenant_id, type_id, field_name, value_text);
CREATE INDEX idx_facets_doc    ON document_facets(document_id);

-- Permissions
CREATE INDEX idx_document_permissions_root ON document_permissions(tenant_id, root_id);
CREATE INDEX idx_document_permissions_principal
  ON document_permissions(tenant_id, principal_type, principal_id, permission);
```

Recommended uniqueness constraints (kept unconditionally — partial unique indexes are fully supported on D1/SQLite and are the only hard concurrency guarantees):

```sql
-- At most one current draft per root.
CREATE UNIQUE INDEX idx_documents_one_current_draft
ON documents(root_id)
WHERE is_current_draft = 1;

-- At most one published revision per root.
CREATE UNIQUE INDEX idx_documents_one_published
ON documents(root_id)
WHERE is_published = 1;

-- Monotonic version numbers per root.
CREATE UNIQUE INDEX idx_documents_unique_version
ON documents(root_id, version_number);

-- Slug uniqueness scoped to the editable identity, per tenant/locale/type/parent.
CREATE UNIQUE INDEX idx_documents_unique_slug
ON documents(tenant_id, locale, type_id, parent_root_id, slug)
WHERE is_current_draft = 1 AND deleted_at IS NULL AND slug IS NOT NULL;

-- One translation per locale within a translation group.
CREATE UNIQUE INDEX idx_documents_one_translation_per_locale
ON documents(tenant_id, translation_group_id, locale)
WHERE is_current_draft = 1 AND translation_group_id <> '';

CREATE UNIQUE INDEX idx_docref_unique
ON document_references(from_document_id, field_name, ordinal);

CREATE UNIQUE INDEX idx_facets_unique
ON document_facets(document_id, field_name, ordinal);

CREATE UNIQUE INDEX idx_document_permissions_unique
ON document_permissions(root_id, principal_type, principal_id, permission);
```

Partial unique indexes are a stable SQLite feature and work on D1. Treat any local or CI tooling that mishandles them as a tooling bug to fix, not a reason to weaken the schema.

## Versioning and Draft/Published Model

Versions live in `documents`, not in a separate version table. The key correction from the first draft is that **"newest revision" and "publicly served" are separate axes**, so a published document can stay live while an editor works on a new draft.

State invariants (maintained by the service, DB-enforced where possible):

- Exactly one row per root has `is_current_draft = 1` (DB enforces "at most one"; the service guarantees "at least one").
- At most one row per root has `is_published = 1`.
- A row may have both flags set (just published, no newer draft yet). This is the common steady state.
- `status` is a derived label for UI/workflow: `draft`, `published`, `archived`. "Published with a newer unpublished draft" is detectable as: one row with `is_published = 1` and a *different* row with `is_current_draft = 1`.

Operations (all multi-statement operations run as a single `env.DB.batch([...])` — see "Write Path and Atomicity"):

- **Create**: insert one row with `root_id = id`, `version_number = 1`, `is_current_draft = 1`, `is_published = 0` (or `1` if publish-on-create). Materialize facets/references for the row.
- **Save new draft of an existing root**: flip the previous `is_current_draft = 0`, insert a new row with the same `root_id`, `version_of_id` pointing at the previous draft, `version_number = MAX(version_number) + 1` (computed in SQL), `is_current_draft = 1`, `is_published = 0`. The previously published row keeps `is_published = 1` and stays live. Materialize facets/references for the new row.
- **Publish a revision**: in one batch, clear `is_published = 0` on the previously published row (and delete its derived facet/reference rows if it is no longer current-draft), set `is_published = 1`, `status = 'published'`, `published_at = ?` on the target row, and ensure the target row's derived rows exist — they already do if it was the current draft; materialize them if publishing an older revision as a rollback.
- **Unpublish**: clear `is_published` on the live row; the page leaves public reads but the draft chain is untouched. If the unpublished row is not the current draft, delete its derived rows in the same batch.
- **Read (admin/editorial)**: `WHERE root_id = ? AND is_current_draft = 1`.
- **Read (public)**: see "Query Strategy → Published Reads" — time-aware and ACL-aware.

Facets and references are materialized **only for the rows that participate in queries — the current-draft row and the published row** (a row that is both carries one set). When a row stops being current-draft or published (superseded by a newer draft, or unpublished), its derived rows are deleted in the same batch. This keeps the derived store small, guarantees the incremental write path and `reindexType` produce identical results (the golden test), and means pruned/historical version rows carry no derived rows to orphan. Both editorial (`is_current_draft = 1`) and public (`is_published = 1`) filtered lists work, and a rollback to an older published revision re-materializes its derived rows on publish. Do not rely on `ON DELETE CASCADE` to remove derived rows — delete them explicitly (D1 foreign-key enforcement is not guaranteed on every execution path).

Version retention: each type may declare `settings.maxVersionsPerRoot` (default ~50). On save, prune the oldest non-published, non-current rows of the root beyond the cap within the same batch. This bounds growth of the hot `documents` table against D1's per-database size cap. The published revision is never pruned.

## Query Strategy

### Direct Document Reads

Use `documents` directly for:

- by document root ID
- by type
- by slug/path
- by status / draft vs published
- by hierarchy/parent
- recently updated
- ownership/user filters

### Published Reads (time-aware, tenant-scoped)

Published reads evaluate the schedule window directly in SQL, so `scheduled_at` / `expires_at` work with no background job. (A Cron Trigger is only needed later for boundary *side effects* such as cache purge and webhooks, which do not exist in the POC.)

```sql
SELECT *
FROM documents
WHERE tenant_id = :tenant
  AND type_id = :type
  AND is_published = 1
  AND deleted_at IS NULL
  AND (scheduled_at IS NULL OR scheduled_at <= :now)
  AND (expires_at  IS NULL OR expires_at  >  :now)
ORDER BY updated_at DESC, id DESC
LIMIT :limit;
```

Cursor pagination uses keyset semantics on `(updated_at, id)` (never `OFFSET`, which is both slow and unstable): append `AND (updated_at, id) < (:cursorUpdatedAt, :cursorId)`.

### Scalar Field Filters (generated columns)

Multi-field filters are ordinary `AND` predicates on one row, served by composite indexes — no joins:

```sql
SELECT *
FROM documents
WHERE tenant_id = :tenant
  AND type_id = 'testimonial'
  AND is_published = 1
  AND deleted_at IS NULL
  AND q_tst_rating >= 4
  AND q_tst_company = 'Example Co'
ORDER BY q_tst_sort_order ASC, id ASC
LIMIT :limit;
```

### Multi-Valued Scalar Filters (facets)

For array fields such as `tags`, join the facet table:

```sql
SELECT d.*
FROM documents d
JOIN document_facets f
  ON f.document_id = d.id
WHERE d.tenant_id = :tenant
  AND d.type_id = 'media_asset'
  AND d.is_published = 1
  AND f.field_name = 'tags'
  AND f.value_text = 'homepage'
ORDER BY d.updated_at DESC, d.id DESC
LIMIT :limit;
```

### References and "Where Used"

Reverse lookups use the dedicated edge table, restricted to live/relevant versions:

```sql
SELECT DISTINCT d.*
FROM document_references r
JOIN documents d
  ON d.id = r.from_document_id
WHERE r.tenant_id = :tenant
  AND r.to_root_id = :targetRoot
  AND (d.is_published = 1 OR d.is_current_draft = 1)
  AND d.deleted_at IS NULL;
```

Referential safety: `from_document_id` carries the only DB-level foreign key (`ON DELETE CASCADE`, defense-in-depth). `to_root_id` intentionally has **no** foreign key — it targets a logical root (which has many version rows), not a single `documents.id`, so SQLite cannot enforce it. Target-side safety is therefore enforced by the service layer: the strong-reference `RESTRICT` check on delete plus the cross-version "where used" scan, with dangling weak references resolved defensively at read time.

### JSON Reads

Use `documents.data` for rendering and complete record reads. Generated columns and the facet/reference tables are for filtering, sorting, and relationship queries; `data` remains canonical for everything else.

## Write Path and Atomicity

D1 has **no interactive transactions**. Separate `.run()` calls are not atomic; a mid-sequence failure corrupts the derived layer. Every multi-statement operation must be a single `env.DB.batch([...])` (or a Drizzle transaction that compiles to a batch), which executes atomically and sequentially under D1's single-writer model.

Save-new-draft, ordered so the partial unique index never observes two current drafts mid-batch:

```ts
await env.DB.batch([
  // 1. Demote the previous current draft FIRST (so the unique index never observes two).
  db.update(documents)
    .set({ isCurrentDraft: 0 })
    .where(and(eq(documents.rootId, rootId), eq(documents.isCurrentDraft, 1))),

  // 2. The demoted row participates in no query unless it is still the published row.
  //    If it is not published, delete its derived facet/reference rows explicitly.
  //    Do NOT rely on FK cascade — D1 foreign-key enforcement is not guaranteed.
  deleteDerivedRowsForSupersededDraft,

  // 3. Insert the new draft. version_number derived in SQL, not JS.
  //    (Raw: INSERT ... SELECT COALESCE(MAX(version_number),0)+1 FROM documents WHERE root_id = ?)
  insertNewDraftRow,

  // 4. Materialize derived rows for the new document_id.
  ...facetInserts,
  ...referenceInserts,

  // 5. Prune versions beyond settings.maxVersionsPerRoot (never the published or current-draft row).
  //    Pruned rows are already neither current nor published, so they carry no derived rows to orphan.
  ...pruneStatements,
])
```

Rules:

- Derive `version_number` in SQL (`SELECT COALESCE(MAX(version_number), 0) + 1`), never compute it in application code (concurrent computation collides).
- Mind D1's hard **100 bound parameters per statement** (not local SQLite's much higher default — 999 on old builds, 32766 since SQLite 3.32). Chunk multi-row facet/reference inserts under ~90 params per statement. This is a production-only limit that local SQLite will not reproduce, so it must be enforced in code and covered by tests.
- **Derived rows (facets/references) exist only for the current-draft and published rows of a root.** Maintain this explicitly on every state transition; never rely on `ON DELETE CASCADE`, since D1 foreign-key enforcement is not guaranteed on every execution path.
- For permission/visibility filtering, prefer correlated `EXISTS` subqueries over `root_id IN (...)` lists, which blow the parameter limit at scale.

## Tenant Isolation

`tenant_id` is a column, not a security boundary by itself. D1/SQLite has **no row-level security** — the only thing separating tenants is that every query includes `AND tenant_id = ?`. This must not depend on each developer remembering it.

- All document reads/writes go through a **single repository layer** that injects `tenant_id` from request context. Route handlers must not build raw SQL or call the DB directly.
- `tenant_id` leads every list/filter index (changing a leading index column after data exists is a full rebuild) and is carried on `document_references`, `document_facets`, and `document_permissions`.
- A **cross-tenant leak test is an acceptance gate**: seed two tenants, assert tenant A's principal can never read, list, filter, or resolve references to tenant B's documents.
- Graduation path for residency/scale tenants: **database-per-tenant**, routing by `tenant_id` at the binding layer with the same migration applied per database. Documented under "Scale and Escape Hatches"; not built in the POC.

## Permissions Model

Permissions combine two layers:

1. **Base grants** (type-level role defaults) stored in `document_types.settings.baseGrants`, e.g. `{ "editor": ["read","create","update","publish"], "viewer": ["read"] }`. A `type_permissions` table is more than the POC's handful of types need.
2. **Per-document overrides** stored in `document_permissions` (allow/deny for a specific principal on a specific root).

The effective-permission decision is a single pure function, specified and unit-tested **before** ACL enforcement is wired into queries (an undefined precedence rule is a classic fail-open bug):

```ts
// Deny wins. Overrides beat base grants. Empty ACL falls back to base grants.
function isAllowed(principalSet: PrincipalRef[], rootId: string, permission: Permission): boolean {
  const overrides = getDocumentPermissions(rootId, principalSet, permission) // user id + role/group ids + 'public'
  if (overrides.some(p => p.effect === 'deny'))  return false  // 1. explicit deny wins, always
  if (overrides.some(p => p.effect === 'allow')) return true   // 2. explicit allow
  return baseGrantAllows(typeOf(rootId), principalSet, permission) // 3. fall back to role defaults
}
```

- **Public reads route through the same resolver** as a `'public'` principal, rather than a separate ACL-skipping query. This makes the public bypass deliberate and testable, and allows a published-but-restricted document to exist.
- Permission checks are injected into list queries via correlated `EXISTS`/`NOT EXISTS` against `document_permissions` (or pre-resolved into the principal's allowed set), not large `IN (...)` lists.
- The CHECK constraints on `effect`, `principal_type`, and `permission` eliminate the typo-driven fail-open class for free.
- A permission-history audit table is deliberately out of scope for the POC (see Non-Goals).
- `document_permissions.inherited` is a forward-compat flag for future ancestor-based ACL propagation; the POC always writes `0` and `isAllowed()` ignores it.

## PII and Right-to-Erasure

The **Contact Message** type stores `email`, `ipAddress`, and `userAgent` — regulated personal data — and the versioning model otherwise preserves the full `data` JSON of every historical row indefinitely. Soft-delete cannot satisfy a right-to-erasure request.

- Implement `erase(rootId)` that, in one batch, **hard-deletes all rows** for the root, ordered so derived tables go first: `document_facets` and `document_references` (by `root_id` / `from_root_id`), then `document_permissions`, then every `documents` version row — and afterward deletes any associated R2 object. The explicit derived-table deletes are the contract; `ON DELETE CASCADE` is defense-in-depth only, because D1 foreign-key enforcement is not guaranteed on every execution path. Inbound weak references from other documents are allowed to dangle and resolve defensively.
- Types holding PII declare `settings.pii = true`. **PII types erase hard; they never archive.** This resolves the soft-delete-vs-archive ambiguity for those types.
- Acceptance test: after `erase`, assert no row in any table contains the subject's email/IP/user-agent, across all versions.

## Document Types and Queryable Field Config

Plugins register document types, not plugin-specific tables. The queryable-field config declares how each field is materialized:

```ts
export interface PluginDocumentType {
  id: string
  name: string
  displayName: string
  description?: string
  schema: z.ZodSchema
  settings?: {
    baseGrants?: Record<string, Permission[]>  // role -> permissions
    maxVersionsPerRoot?: number                 // default ~50
    pii?: boolean                               // hard-erase instead of archive
  }
  queryableFields?: Array<{
    name: string
    path?: string                               // JSON path; defaults to $.<name>
    kind: 'scalar' | 'facet' | 'reference'      // scalar -> generated column; facet -> document_facets; reference -> document_references
    type?: 'text' | 'number' | 'integer' | 'boolean' | 'date' // for scalar/facet
    column?: string                             // generated-column name (POC: hand-assigned in migration 037)
    refStrength?: 'strong' | 'weak'             // for reference kind
  }>
}
```

Example registration:

```ts
builder.addDocumentType({
  id: 'faq',
  name: 'faq',
  displayName: 'FAQ',
  schema: faqSchema,
  settings: { baseGrants: { editor: ['read','create','update','publish'], viewer: ['read'] } },
  queryableFields: [
    { name: 'category',  kind: 'scalar', type: 'text',    column: 'q_faq_category' },
    { name: 'sortOrder', kind: 'scalar', type: 'integer', column: 'q_faq_sort_order' }
  ]
})
```

Activation behavior:

- Activating a plugin registers or updates its `document_types` rows (idempotent) and stamps `schema_version`.
- Deactivating a plugin sets the type inactive or hides plugin routes/admin UI. Deactivation does not delete documents.
- Uninstall can optionally archive documents, but destructive deletes must be explicit.
- New queryable scalar fields introduced by a plugin upgrade are added as `VIRTUAL` generated columns (no backfill). Facet/reference fields are materialized going forward and, if historical coverage is required, via an explicit `reindexType` job.

## Schema Evolution and Re-materialization

- `documents.type_version` is stamped at write time from `document_types.schema_version`. This records which schema shape a row was written against and cannot be backfilled correctly later, so it is captured from day one.
- Generated columns require no backfill when added (`VIRTUAL`). This eliminates most of the re-materialization burden the EAV design carried.
- For facet/reference fields added after documents exist, provide a `reindexType(typeId)` admin action that, per root, deletes any stray derived rows and rebuilds `document_facets`/`document_references` for exactly the current-draft and published rows (matching the incremental rule above, so the golden test holds), batched under D1's 1,000-rows-per-batch guidance. Not chunked cron orchestration — a simple bounded admin action for the POC.
- **Golden test**: build the facet/reference rows for a document via the incremental write path, then rebuild them via `reindexType`, and assert the two are identical. This is the correctness property of any derived store.

## Candidate Document Types

### Media Asset

```json
{
  "filename": "hero.jpg",
  "originalName": "hero.jpg",
  "mimeType": "image/jpeg",
  "size": 123456,
  "width": 1600,
  "height": 900,
  "folder": "uploads",
  "r2Key": "uploads/hero.jpg",
  "alt": "Hero image",
  "caption": "",
  "tags": ["homepage"]
}
```

Queryable fields:

- `mimeType` (scalar), `folder` (scalar), `size` (scalar)
- `tags` (facet)

Note: store the canonical `r2Key` plus intrinsic `width`/`height`/`mimeType`. Do **not** enshrine `publicUrl`/`thumbnailUrl` in the payload — derive variants at read time via Cloudflare Images / `/cdn-cgi/image/` so the URL/transform strategy can change without rewriting stored data.

### FAQ

```json
{ "question": "What is SonicJS?", "answer": "A Cloudflare-native CMS.", "category": "general", "sortOrder": 10 }
```

Queryable fields: `category` (scalar), `sortOrder` (scalar).

### Testimonial

```json
{ "authorName": "Jane Doe", "authorTitle": "CTO", "authorCompany": "Example Co", "testimonialText": "Great CMS.", "rating": 5, "sortOrder": 1 }
```

Queryable fields: `rating` (scalar), `sortOrder` (scalar), `authorCompany` (scalar).

### Contact Message

```json
{ "name": "Jane Doe", "email": "jane@example.com", "message": "Please contact me.", "ipAddress": "203.0.113.10", "userAgent": "Mozilla/5.0", "reviewStatus": "new" }
```

Queryable fields: `email` (scalar), `reviewStatus` (scalar). Type settings: `pii: true`. Contact messages are inbound and never published; they live their whole lifecycle as the current draft, which is why their filter indexes (`idx_q_msg_review`, `idx_q_msg_email`) are scoped to `is_current_draft = 1`.

## Media Handling

Media files still upload to R2. Metadata is stored as a `media_asset` document.

Upload flow:

1. Validate file and permissions.
2. Write object bytes to R2.
3. Extract metadata (MIME type, size, dimensions, `r2Key`).
4. Create a `media_asset` document.
5. Materialize generated-column scalars (automatic) and `tags` facet rows.

Delete/archive flow:

1. Check `document_references` for inbound references to the media root (across published and current-draft consumers).
2. If any inbound `ref_strength = 'strong'` exists, block hard-delete (`RESTRICT`); offer archive instead. Weak references may dangle and are resolved defensively at read time.
3. Soft-delete or archive the media document per retention policy; for PII-flagged types, hard-erase instead.
4. Remove or mark the R2 object according to retention policy.

Embedded references (assets referenced inside rich-text bodies rather than declared fields) are invisible to field-level extraction. None of the four candidate types have rich-text bodies yet, so: **adopt a structured rich-text contract (portable-text-style JSON, not HTML) in the type-config now** so embedded references are tree-walkable without an HTML parser. Defer the recursive extractor until a body field actually exists.

## Compatibility Adapter

Existing media consumers may assume a dedicated `media` table shape. Phase 4 adds a thin adapter that maps `media_asset` documents to the legacy media-record shape so existing image/media field rendering resolves document-backed media without changes. References must point to **document roots only, never version rows**.

## Dedicated Table Escape Hatches

Keep dedicated tables when a feature needs:

- High write volume (analytics events, security events, request logs, queues).
- Strict protocol-specific constraints (sessions, auth tokens, OAuth accounts, password reset tokens).
- Append-only audit/event retention at high scale.
- Operational ownership outside the document repository.
- Workloads better suited to R2 Data Catalog or external analytics.

Likely dedicated platform tables to keep outside the document model:

- `users`
- auth/session/token tables
- `plugins`
- `settings`, unless intentionally converted to documents later
- high-volume system/security logs
- analytics event tables

## Scale and Escape Hatches (Cloudflare D1 reality)

State the ceilings explicitly so the design's limits are deliberate:

- **A single D1 database is capped (10 GB at time of writing)**, shared across all tenants, all full-JSON version rows, facets, references, and indexes. The dominant amplifier is full-snapshot-per-edit in the hot `documents` table — the per-type `maxVersionsPerRoot` retention cap is what makes "keep versions in `documents`" survivable.
- **100 bound parameters per statement** (a hard D1 limit; local SQLite's default is far higher — 999 on old builds, 32766 since 3.32 — so this will not reproduce locally). Enforced by chunking writes and using `EXISTS` over `IN (...)`.
- **100 columns per table.** Generated columns accumulate on the shared `documents` table across all types. The graduation path when a type would push the shared table toward the cap is a **per-type projection table** rebuilt from `data` on write — reserved, not built.
- **Read replication / Sessions API** is opt-in and almost certainly off for the POC, so there is no stale-replica read-after-write hazard to close. Noted as a one-liner for later.
- **Database-per-tenant** is the isolation/scale graduation path for large or residency-bound tenants; the same migration applies per database, routed by `tenant_id` at the binding layer.

## Implementation Architecture

Suggested files:

| File | Action | Description |
|------|--------|-------------|
| `packages/core/migrations/037_document_repository.sql` | Create | Five tables, generated columns, indexes, partial unique indexes |
| `packages/core/src/services/document-type-registry.ts` | Create | Register/sync code/plugin document type definitions; idempotent |
| `packages/core/src/services/document-repository.ts` | Create | Single tenant-scoped data-access chokepoint (all reads/writes) |
| `packages/core/src/services/documents.ts` | Create | CRUD, validation, lifecycle, versioning, publish, erase (uses `db.batch`) |
| `packages/core/src/services/document-projection.ts` | Create | Materialize facets/references from JSON data; `reindexType` |
| `packages/core/src/services/document-permissions.ts` | Create | `isAllowed` resolver, base-grant + override evaluation |
| `packages/core/src/schemas/document.ts` | Create | Zod schemas for type config and document writes |
| `packages/core/src/routes/admin-documents.ts` | Create | Minimal admin routes for document lists/forms |
| `packages/core/src/routes/document-api.ts` | Create | API routes for document CRUD + published reads with cursor pagination |

## Implementation Phases

### Phase 1: Schema and Services

- [ ] Add `037_document_repository.sql` (tables, generated columns, indexes, partial unique indexes).
- [ ] Regenerate `packages/core/src/db/migrations-bundle.ts`.
- [ ] Implement document type registry and DB sync (idempotent; stamps `schema_version`).
- [ ] Implement the tenant-scoped document repository chokepoint.
- [ ] Implement document CRUD with `db.batch`-atomic writes and SQL-derived `version_number`.
- [ ] Implement the two-axis draft/published model (`is_current_draft`, `is_published`) with publish/unpublish.
- [ ] Implement facet/reference materialization and `reindexType`.
- [ ] Implement `isAllowed` with base grants + overrides and deny-wins precedence.
- [ ] Implement `erase(rootId)` for PII types.
- [ ] Unit tests: create, save-draft, publish, versioning invariants, facets, references, permissions, erase, tenant isolation, the golden reindex test.

Acceptance criteria:

- [ ] Fresh D1 database has the five document repository tables and generated columns.
- [ ] Document type registration is idempotent.
- [ ] Document writes validate against the registered type schema.
- [ ] Saving a draft of a published document leaves the published revision live.
- [ ] Multi-field scalar filters return correct results with no joins.
- [ ] `db.batch` writes are atomic (an injected mid-batch failure leaves no partial state).
- [ ] Base + override ACL checks allow/deny a document read with deny-wins.
- [ ] A cross-tenant read/list/filter/reference attempt is denied.

### Phase 2: Minimal API

- [ ] Authenticated admin CRUD routes (through the repository chokepoint).
- [ ] Read-only public API for published documents, time-aware (`scheduled_at`/`expires_at`).
- [ ] Scalar filters via generated columns; multi-valued filters via facets.
- [ ] Sort by title, updated date, published date, and queryable scalars.
- [ ] **Cursor pagination on `(updated_at, id)`** (no `OFFSET`).
- [ ] Explicit error responses for validation and permission failures.

Acceptance criteria:

- [ ] Admin can create/update/publish FAQ/testimonial documents through the API.
- [ ] Public API returns only currently-published documents (respects schedule window).
- [ ] Filtering/sorting use generated columns and facets.
- [ ] Pagination is stable under concurrent inserts.
- [ ] Unauthorized users cannot read restricted documents.

### Phase 3: Admin UI Slice

- [ ] Document type list page.
- [ ] Document list page for one type with filters/sorts.
- [ ] Generated form for basic field types.
- [ ] Publish/unpublish controls and "edit while published" flow.
- [ ] Simple ACL controls for roles.

Acceptance criteria:

- [ ] Admin can manage FAQ documents through the UI, including editing a live doc without unpublishing it.
- [ ] Validation and permission-denied states render clearly.
- [ ] Existing content/admin routes continue to work.

### Phase 4: Media-as-Document

- [ ] `media_asset` document type.
- [ ] R2 upload → document creation path.
- [ ] Scalar generated columns + `tags` facet materialization.
- [ ] Compatibility adapter for existing media consumers; references resolve to roots only.
- [ ] Admin media list using document queries (filter by MIME type, folder, tags).
- [ ] Reference-aware delete: strong inbound references block hard-delete.

Acceptance criteria:

- [ ] Upload creates an R2 object and a `media_asset` document.
- [ ] Media list filters by MIME type, folder, and tags.
- [ ] Existing media field rendering resolves document-backed media.
- [ ] Delete checks inbound references first and honors strong/weak semantics.

### Phase 5: Plugin POC

- [ ] Convert one low-risk plugin to document-backed storage behind a feature flag.
- [ ] Recommended first target: FAQ, testimonials, or contact-form messages.
- [ ] Register plugin document types during bootstrap.
- [ ] Keep the existing table-backed plugin path available.
- [ ] Tests proving disabled plugin behavior does not require plugin-specific tables.

Acceptance criteria:

- [ ] The selected plugin works without a dedicated plugin table.
- [ ] Deactivating the plugin hides routes/admin UI but preserves documents.
- [ ] Re-activating restores access to existing documents.

## Testing Strategy

### Unit Tests

Add tests under `packages/core/src/__tests__` or next to the services:

- Document type registration is idempotent; `schema_version` is stamped onto written rows.
- Document creation validates required fields; invalid data returns field-level errors.
- Save-draft creates a new row with the same `root_id`, demotes the previous draft, and leaves a published row live.
- Publish moves `is_published` atomically; only one published row per root ever exists.
- Multi-field scalar filters return correct results (e.g. `rating >= 4 AND authorCompany = ?`).
- Facet filters (tags contains X) and `ordinal` ordering behave correctly.
- References support reverse "where used" lookups; strong vs weak delete semantics enforced.
- `db.batch` atomicity: an injected failure mid-batch leaves no partial state.
- `version_number` is monotonic under simulated concurrent saves (unique index holds).
- Slug uniqueness enforced for the current draft per tenant/locale/type/parent.
- Published/public reads exclude drafts, deleted, unscheduled, and expired rows.
- Permission checks: deny-wins, overrides beat base grants, empty ACL falls back to base grants.
- Tenant isolation: tenant A cannot read/list/filter/reference tenant B's data.
- PII erase removes the subject from every version and every table.
- Pruning a version and superseding a draft leave zero orphaned facet/reference rows (derived rows exist only for current-draft/published).
- Golden test: incremental materialization == `reindexType` rebuild.

### E2E Tests

Add a Playwright spec under `tests/e2e/`:

```text
tests/e2e/44-document-repository.spec.ts
```

Coverage:

- Admin creates an FAQ document, publishes it, edits it while it stays live, then republishes.
- Public API reads only the published revision.
- Admin filters FAQ documents by category and testimonials by rating + company.
- Validation error appears when a required field is missing.
- Restricted document is hidden from an unauthorized user; public-restricted behaves correctly.

### Verification Commands

```bash
npm run type-check
npm test
npm run e2e
```

For local D1 validation:

```bash
cd my-sonicjs-app
npm run setup:db
```

Note: the **100-bound-parameter** and **100-column** limits are D1-specific and will not surface against local SQLite. Cover them with explicit unit tests (chunking logic, column budget) rather than relying on local runs.

## Risks

- Generated columns largely remove the derived-layer drift risk for scalars (engine-derived). The remaining derived layer — `document_facets` and `document_references` — still requires the golden test and `reindexType` repair path.
- The two-axis draft/published model must maintain its invariants in the service; the partial unique indexes catch the dangerous duplicate cases but not "zero current drafts."
- Document-level ACL inheritance/precedence must match the specified `isAllowed` algorithm exactly; test the truth table before wiring it into queries.
- Tenant isolation depends on the repository chokepoint; raw DB access from route handlers must be prohibited and caught in review.
- Existing media code may assume a dedicated `media` table shape; the compatibility adapter mitigates this.
- D1 migrations remain global today, so plugin-scoped migration behavior is separate from this POC.
- The shared `documents` table accrues generated columns across types; monitor against the 100-column cap and switch a type to a projection table before it is reached.

## Decisions Finalized (previously open)

| Decision | Resolution |
|---|---|
| Materialize all fields vs. queryable only | Queryable only. Scalars → generated columns; multi-valued → facets; references always extracted regardless of other flags. |
| Type schemas editable in admin vs. code-managed | Code/plugin-managed for the POC; admin editing is later. |
| Settings as documents | Keep as a dedicated table for now; revisit post-POC. |
| Media references to roots only, never version rows | Yes, roots only. Delete-impact check scans published and current-draft consumers. |
| Tenant/site/locale as columns vs. dedicated tables | Columns for the POC; add `translation_group_id`; database-per-tenant is the documented graduation path. |
| Deleted = current + `deleted_at` vs. archived version | Keep current draft + `deleted_at` (excluded from the slug index so restore does not collide). PII types erase hard instead. |
| Versions in `documents` vs. snapshot table | Keep in `documents` + `maxVersionsPerRoot` retention cap for the POC. A snapshot-table split is the right enterprise answer later and is a deliberate reversal, not an accident. |

## Success Criteria

The POC is successful if:

- A plugin-backed feature works end to end without a dedicated plugin table.
- Media metadata works as a document without breaking upload/list/render flows.
- Admin filters use generated columns and facets, support multiple predicates at once, and remain understandable.
- A published document can be edited and re-published without going offline.
- Per-document permissions enforce deny-wins over base grants, and tenant isolation holds.
- PII can be fully erased across all versions.
- Version history works without a separate versions table and stays bounded by retention.
- The schema remains stable after adding several document types (no column-cap pressure).

## Recommended First Slice

Start with FAQ or testimonials before media.

Rationale:

- Low operational risk.
- Simple scalar fields (exercise generated columns and the two-axis publish model).
- Easy admin and public API validation, including cursor pagination and multi-field filters.
- Clear comparison with existing plugin-specific migrations.

After that works, add media-as-document as the second slice because it exercises R2 integration, the `tags` facet path, references with strong/weak delete semantics, and adapter compatibility.
