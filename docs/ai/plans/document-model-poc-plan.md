# Enterprise Document Model POC Development Plan

## Overview

Build a SonicJS proof of concept for a small, production-capable document repository. The goal is not the absolute fewest tables. The goal is the fewest tables that can support an enterprise CMS long-term without turning query performance, permissions, schema introspection, references, and versioning into later rewrites.

The proposed repository uses four core document tables:

1. `document_types` - code/plugin registered schema definitions.
2. `documents` - all content, media metadata, plugin records, and historical versions.
3. `document_values` - typed, queryable field values and document references derived from JSON data.
4. `document_permissions` - per-document ACL overrides.

This mirrors the N2CMS item/detail/role model, but modernizes it for JSON payloads, code-managed schemas, D1, R2 media, plugin registration, and typed query fields.

This POC should run alongside the current `collections`, `content`, and plugin table system until the model is proven.

## Goals

- Establish a finalized small schema that is viable for enterprise production use.
- Store most CMS and plugin records as typed documents instead of plugin-specific tables.
- Store media metadata as documents while keeping file bytes in Cloudflare R2.
- Support fast enough admin filtering/searching without per-plugin schema migrations.
- Support references, "where used" lookups, and media/content relationship tracking.
- Support per-document permissions without embedding ACLs only in JSON.
- Keep dedicated tables only for platform infrastructure that genuinely needs them.

## Non-Goals

- Do not migrate existing production data in the POC.
- Do not remove existing migrations or plugin-specific tables during the first implementation.
- Do not replace auth/session/token tables with documents.
- Do not replace high-volume logs, analytics events, or queues with documents.
- Do not use R2 Data Catalog as the live operational backend.

## Schema Decision

A one-table JSON-only model is attractive, but it is too weak as the final production target.

Enterprise CMS use cases usually need:

- Admin list filters and sorts over arbitrary fields.
- Stable schema/type introspection for generated forms and APIs.
- References between documents, such as media usage and related content.
- Reverse lookups before delete/archive operations.
- Document-level permission overrides.
- Historical versions without separate per-plugin version tables.

The four-table model is the smallest durable baseline:

- `documents.data` remains the source of truth for full document payloads.
- `document_values` is a derived, transactional query/reference table for selected fields.
- `document_permissions` keeps ACL checks queryable and auditable.
- `document_types` keeps schemas explicit instead of relying only on runtime imports.

## Terminology

- **Document**: A typed record stored in `documents`, including content, media metadata, settings-like plugin records, and versions.
- **Document type**: A code/plugin registered schema stored in `document_types`.
- **Document data**: JSON payload in `documents.data`; this is the canonical full record data.
- **Document value**: A typed, queryable field row in `document_values`, derived from selected fields in `documents.data`.
- **Document reference**: A `document_values` row whose value points to another document root.
- **Asset document**: A media document whose metadata lives in D1 and whose file bytes live in R2.
- **Root document**: The stable logical document ID shared by all versions.
- **Version row**: A row in `documents` with the same `root_id` as the original document.

## Core Schema

Create one migration for the document repository tables.

```sql
CREATE TABLE document_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  schema TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  plugin_id TEXT,
  source TEXT NOT NULL DEFAULT 'code',
  version INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL,
  type_id TEXT NOT NULL REFERENCES document_types(id),

  -- Versioning. The first version uses root_id = id.
  version_of_id TEXT REFERENCES documents(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 1,

  -- Hierarchy and routing.
  parent_root_id TEXT NOT NULL DEFAULT '',
  slug TEXT,
  path TEXT,
  title TEXT,
  zone TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,

  -- Lifecycle.
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  scheduled_at INTEGER,
  expires_at INTEGER,
  deleted_at INTEGER,

  -- Enterprise-ready partitioning. Defaults keep single-tenant installs simple.
  tenant_id TEXT NOT NULL DEFAULT 'default',
  locale TEXT NOT NULL DEFAULT 'default',

  -- Canonical payload and extra system metadata.
  data TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',

  -- Ownership and audit fields.
  owner_id TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE document_values (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  root_id TEXT NOT NULL,
  type_id TEXT NOT NULL REFERENCES document_types(id),

  -- Field identity. field_path supports nested JSON fields.
  field_name TEXT NOT NULL,
  field_path TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,

  -- Typed values. Only the matching value column is populated.
  value_type TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_integer INTEGER,
  value_boolean INTEGER,
  value_date INTEGER,
  value_document_root_id TEXT,

  created_at INTEGER NOT NULL
);

CREATE TABLE document_permissions (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  inherited INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id)
);
```

Recommended indexes:

```sql
CREATE INDEX idx_document_types_plugin ON document_types(plugin_id);
CREATE INDEX idx_document_types_active ON document_types(is_active);

CREATE INDEX idx_documents_root ON documents(root_id, version_number DESC);
CREATE INDEX idx_documents_current_type ON documents(type_id, is_current);
CREATE INDEX idx_documents_status ON documents(type_id, status, is_current);
CREATE INDEX idx_documents_parent ON documents(parent_root_id, is_current, sort_order);
CREATE INDEX idx_documents_path ON documents(path);
CREATE INDEX idx_documents_updated ON documents(type_id, is_current, updated_at DESC);
CREATE INDEX idx_documents_tenant_locale ON documents(tenant_id, locale, type_id, is_current);
CREATE INDEX idx_documents_deleted ON documents(deleted_at);

CREATE INDEX idx_document_values_text ON document_values(type_id, field_path, value_text);
CREATE INDEX idx_document_values_number ON document_values(type_id, field_path, value_number);
CREATE INDEX idx_document_values_integer ON document_values(type_id, field_path, value_integer);
CREATE INDEX idx_document_values_boolean ON document_values(type_id, field_path, value_boolean);
CREATE INDEX idx_document_values_date ON document_values(type_id, field_path, value_date);
CREATE INDEX idx_document_values_document_ref ON document_values(value_document_root_id);
CREATE INDEX idx_document_values_root ON document_values(root_id);

CREATE INDEX idx_document_permissions_root ON document_permissions(root_id);
CREATE INDEX idx_document_permissions_principal ON document_permissions(principal_type, principal_id, permission);
```

Recommended uniqueness constraints:

```sql
CREATE UNIQUE INDEX idx_documents_one_current_version
ON documents(root_id)
WHERE is_current = 1;

CREATE UNIQUE INDEX idx_documents_current_type_parent_slug
ON documents(tenant_id, locale, type_id, parent_root_id, slug)
WHERE is_current = 1 AND deleted_at IS NULL AND slug IS NOT NULL;

CREATE UNIQUE INDEX idx_document_values_unique_field_value
ON document_values(document_id, field_path, ordinal);

CREATE UNIQUE INDEX idx_document_permissions_unique
ON document_permissions(root_id, principal_type, principal_id, permission);
```

If D1 partial-index behavior is problematic in local or CI environments, enforce partial uniqueness rules in the service layer and keep the non-unique supporting indexes.

## Versioning Model

Versions live in `documents`, not in a separate version table.

- Creating a document inserts one row with `root_id = id`, `version_number = 1`, and `is_current = 1`.
- Updating a document inserts a new row with the same `root_id`, `version_of_id` pointing to the previous current row, and `version_number + 1`.
- The previous current row is updated to `is_current = 0`.
- `document_values` rows are generated only for the current row by default.
- Historical rows preserve their full `data` JSON and can be queried through `root_id` and `version_number`.
- Normal reads use `WHERE root_id = ? AND is_current = 1`.
- Published reads use `status = 'published'`, `is_current = 1`, and lifecycle date checks.

## Document Values Model

`document_values` is required for the long-term schema. It is not the canonical content store; it is the typed query and reference layer derived from `documents.data`.

Use it for:

- Admin filters and sorts over selected fields.
- Numeric/date comparisons without JSON string scanning.
- Relationship tracking.
- Media usage lookups.
- "Where used" checks before delete/archive.
- Repeated values and arrays through `ordinal`.

The document service must update `documents` and `document_values` in the same logical write path. On every current-version update:

1. Insert the new `documents` row.
2. Mark the previous current row non-current.
3. Delete old `document_values` for the previous current `document_id`.
4. Insert `document_values` for the new current row based on the document type field config.

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
  "publicUrl": "https://cdn.example.com/uploads/hero.jpg",
  "thumbnailUrl": "https://cdn.example.com/uploads/hero-thumb.jpg",
  "alt": "Hero image",
  "caption": "",
  "tags": ["homepage"]
}
```

Recommended queryable fields:

- `mimeType`
- `folder`
- `size`
- `width`
- `height`
- `tags`

### FAQ

```json
{
  "question": "What is SonicJS?",
  "answer": "A Cloudflare-native CMS.",
  "category": "general",
  "sortOrder": 10
}
```

Recommended queryable fields:

- `category`
- `sortOrder`

### Testimonial

```json
{
  "authorName": "Jane Doe",
  "authorTitle": "CTO",
  "authorCompany": "Example Co",
  "testimonialText": "Great CMS.",
  "rating": 5,
  "sortOrder": 1
}
```

Recommended queryable fields:

- `rating`
- `sortOrder`
- `authorCompany`

### Contact Message

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "Please contact me.",
  "ipAddress": "203.0.113.10",
  "userAgent": "Mozilla/5.0",
  "reviewStatus": "new"
}
```

Recommended queryable fields:

- `email`
- `reviewStatus`
- `createdAt`

## Plugin Integration

Plugins should register document types, not create plugin-specific tables by default.

Example type definition:

```ts
export interface PluginDocumentType {
  id: string
  name: string
  displayName: string
  description?: string
  schema: z.ZodSchema
  settings?: Record<string, unknown>
  queryableFields?: Array<{
    name: string
    path?: string
    type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'document'
    multiple?: boolean
  }>
}
```

Example plugin registration:

```ts
builder.addDocumentType({
  id: 'faq',
  name: 'faq',
  displayName: 'FAQ',
  schema: faqSchema,
  queryableFields: [
    { name: 'category', type: 'text' },
    { name: 'sortOrder', type: 'integer' }
  ]
})
```

Activation behavior:

- Activating a plugin registers or updates its `document_types` rows.
- Deactivating a plugin sets the type inactive or hides plugin routes/admin UI.
- Deactivation does not delete documents.
- Uninstall can optionally archive documents, but destructive deletes must be explicit.

## Media Handling

Media files should still upload to R2. Metadata is stored as a `media_asset` document.

Upload flow:

1. Validate file and permissions.
2. Write object bytes to R2.
3. Extract metadata such as MIME type, size, dimensions, R2 key, and URLs.
4. Create a `media_asset` document.
5. Materialize queryable fields into `document_values`.

Delete/archive flow:

1. Check `document_values` for references to the media document root.
2. Soft-delete or archive the media document.
3. Remove or mark the R2 object according to retention policy.
4. Keep references resolvable when possible to avoid breaking previews.

## Query Strategy

### Direct Document Reads

Use `documents` directly for:

- by document root ID
- by type
- by slug/path
- by status
- by hierarchy/parent
- by published/current lifecycle
- recently updated
- ownership/user filters

Example:

```sql
SELECT *
FROM documents
WHERE type_id = ?
  AND is_current = 1
  AND status = 'published'
  AND deleted_at IS NULL
ORDER BY updated_at DESC;
```

### Field Filters

Use `document_values` for operational filters and sorts over queryable fields.

Example:

```sql
SELECT d.*
FROM documents d
JOIN document_values v
  ON v.document_id = d.id
WHERE d.type_id = 'faq'
  AND d.is_current = 1
  AND d.status = 'published'
  AND v.field_path = 'category'
  AND v.value_text = 'general'
ORDER BY d.updated_at DESC;
```

### References

Document references are stored in `document_values.value_document_root_id`.

Example media usage lookup:

```sql
SELECT d.*
FROM documents d
JOIN document_values v
  ON v.document_id = d.id
WHERE d.is_current = 1
  AND v.value_document_root_id = ?;
```

### JSON Reads

Use `documents.data` for rendering and complete record reads. JSON extraction is acceptable for ad hoc admin tools and debugging, but production list/filter workflows should use `document_values`.

## Dedicated Table Escape Hatches

Keep dedicated tables when a feature needs:

- High write volume, such as analytics events, security events, request logs, or queues.
- Strict protocol-specific constraints, such as sessions, auth tokens, OAuth accounts, or password reset tokens.
- Append-only audit/event retention at high scale.
- Operational ownership outside the document repository.
- Workloads better suited to R2 Data Catalog or external analytics.

Likely dedicated platform tables to keep outside the document model:

- `users`
- auth/session/token tables
- `plugins`
- `settings`, unless settings are intentionally converted to documents later
- high-volume system/security logs
- analytics event tables

## Implementation Architecture

Suggested files:

| File | Action | Description |
|------|--------|-------------|
| `packages/core/migrations/037_document_repository.sql` | Create | Add the four-table document repository |
| `packages/core/src/services/document-type-registry.ts` | Create | Register and sync code/plugin document type definitions |
| `packages/core/src/services/documents.ts` | Create | CRUD, validation, lifecycle, versioning |
| `packages/core/src/services/document-values.ts` | Create | Materialize typed values from JSON data |
| `packages/core/src/services/document-permissions.ts` | Create | ACL checks and permission writes |
| `packages/core/src/schemas/document.ts` | Create | Zod schemas for document type config and document writes |
| `packages/core/src/routes/admin-documents.ts` | Create | Minimal admin routes for document lists/forms |
| `packages/core/src/routes/document-api.ts` | Create | API routes for document CRUD |

## Implementation Phases

### Phase 1: Schema and Services

- [ ] Add `037_document_repository.sql`.
- [ ] Regenerate `packages/core/src/db/migrations-bundle.ts`.
- [ ] Implement document type registry and DB sync.
- [ ] Implement document CRUD service.
- [ ] Implement versioning in `documents`.
- [ ] Implement `document_values` materialization.
- [ ] Implement basic permission checks.
- [ ] Add unit tests for create, update, versioning, query values, references, and permissions.

Acceptance criteria:

- [ ] Fresh D1 database has the four document repository tables.
- [ ] Document type registration is idempotent.
- [ ] Document writes validate against the registered type schema.
- [ ] Updates create new document rows and mark old rows non-current.
- [ ] Queryable fields are materialized into `document_values`.
- [ ] Basic ACL checks can allow or deny a document read.

### Phase 2: Minimal API

- [ ] Add authenticated admin CRUD routes.
- [ ] Add read-only public API for published documents.
- [ ] Support filters through `document_values`.
- [ ] Support sort by title, updated date, published date, and queryable fields.
- [ ] Add explicit error responses for validation and permission failures.

Acceptance criteria:

- [ ] Admin can create and update FAQ/testimonial documents through API.
- [ ] Public API returns only published documents.
- [ ] Filtering and sorting use `document_values`.
- [ ] Unauthorized users cannot read restricted documents.

### Phase 3: Admin UI Slice

- [ ] Add a document type list page.
- [ ] Add a document list page for one type.
- [ ] Add a generated form for basic field types.
- [ ] Add publish/unpublish controls.
- [ ] Add simple ACL controls for roles.

Acceptance criteria:

- [ ] Admin can manage FAQ documents through the UI.
- [ ] Validation errors render clearly.
- [ ] Permission-denied states render clearly.
- [ ] Existing content/admin routes continue to work.

### Phase 4: Media-as-Document

- [ ] Add `media_asset` document type.
- [ ] Implement R2 upload to document creation path.
- [ ] Materialize media query fields into `document_values`.
- [ ] Add compatibility adapter so existing media consumers can read document-backed media.
- [ ] Add admin media list using document queries.
- [ ] Verify references from content fields to media documents.

Acceptance criteria:

- [ ] Upload creates an R2 object and a `media_asset` document.
- [ ] Media list filters by MIME type, folder, and tags through `document_values`.
- [ ] Existing image/media field rendering can resolve document-backed media.
- [ ] Media delete/archive checks reference usage first.

### Phase 5: Plugin POC

- [ ] Convert one low-risk plugin to document-backed storage behind a feature flag.
- [ ] Recommended first target: FAQ, testimonials, or contact-form messages.
- [ ] Register plugin document types during bootstrap.
- [ ] Keep existing table-backed plugin path available.
- [ ] Add tests proving disabled plugin behavior does not require plugin-specific tables.

Acceptance criteria:

- [ ] The selected plugin works without creating a dedicated plugin table.
- [ ] Deactivating the plugin hides routes/admin UI but preserves documents.
- [ ] Re-activating the plugin restores access to existing documents.

## Testing Strategy

### Unit Tests

Add tests under `packages/core/src/__tests__` or next to the services:

- Document type registration is idempotent.
- Document creation validates required fields.
- Invalid document data returns field-level errors.
- Updates create new rows with the same `root_id` and mark the previous row non-current.
- Queryable fields are inserted, updated, and deleted correctly.
- Repeated fields use `ordinal` correctly.
- Document references support reverse lookups.
- Slug uniqueness is enforced for current rows.
- Published/public reads exclude drafts and deleted rows.
- Permission checks enforce role/user ACLs.

### E2E Tests

Add a Playwright spec under `tests/e2e/`.

Suggested file:

```text
tests/e2e/44-document-repository.spec.ts
```

Coverage:

- Admin can create an FAQ document.
- Admin can publish it.
- Public API can read it.
- Admin can filter FAQ documents by category.
- Validation error appears when a required field is missing.
- Restricted document is hidden from an unauthorized user.

### Verification Commands

Run before sign-off:

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

## Risks

- `document_values` must stay transactionally consistent with `documents.data`.
- Generic field filters can become complex for deeply nested data if the schema allows too much shape variance.
- Self-referential version rows require service invariants so only one row per `root_id` is current.
- Document-level ACLs need clear inheritance rules to avoid surprising access behavior.
- Existing media code may assume a dedicated `media` table shape.
- D1 migrations remain global today, so plugin-scoped migration behavior is separate from this POC.

## Decisions To Finalize During POC

- Whether `document_values` should materialize all declared fields or only fields marked queryable.
- Whether document type schemas should be editable in admin or code/plugin managed only.
- Whether settings should eventually be documents.
- Whether media references should point to document roots only, never version rows.
- Whether tenant/site/locale should remain nullable text fields or graduate into dedicated platform tables.
- Whether deleted documents should remain current with `deleted_at`, or create a new archived version row.

## Success Criteria

The POC is successful if:

- A plugin-backed feature works end to end without a dedicated plugin table.
- Media metadata works as a document without breaking upload/list/render flows.
- Admin filters use `document_values` and remain understandable.
- Per-document permissions can be enforced.
- Version history works without a separate versions table.
- The schema remains stable after adding several document types.

## Recommended First Slice

Start with FAQ or testimonials before media.

Rationale:

- Low operational risk.
- Simple fields.
- Easy admin and public API validation.
- Clear comparison with existing plugin-specific migrations.

After that works, add media-as-document as the second slice because it exercises R2 integration, references, filtering, and adapter compatibility.
