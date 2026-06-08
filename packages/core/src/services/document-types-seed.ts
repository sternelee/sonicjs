import { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { DocumentTypeRegistry } from './document-type-registry'
import { loadCollectionConfigs } from './collection-loader'

// Passthrough schema: accepts any JSON object for POC types.
// Individual fields are validated at the queryable-field level; the full
// payload schema is a future enhancement (addDocumentType will accept Zod schemas).
const anyObject = z.record(z.string(), z.unknown())

// Registers the POC document types idempotently during bootstrap.
// These are the candidate types from the document model plan.
// Each call is a no-op if the type already exists and the schema hasn't changed.
export async function bootstrapDocumentTypes(db: D1Database): Promise<void> {
  const registry = new DocumentTypeRegistry(db)

  await registry.register({
    id: 'faq',
    name: 'faq',
    displayName: 'FAQ',
    description: 'Frequently asked questions',
    source: 'system',
    schema: anyObject,
    settings: {
      // public:['read'] makes published FAQs publicly readable through the ACL resolver; the public
      // API routes everything through isAllowed (no ACL-skipping path), so this grant is required.
      baseGrants: { public: ['read'], admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
      maxVersionsPerRoot: 50,
    },
    queryableFields: [
      { name: 'category',  kind: 'scalar', type: 'text',    column: 'q_faq_category' },
      { name: 'sortOrder', kind: 'scalar', type: 'integer',  column: 'q_faq_sort_order' },
    ],
  })

  await registry.register({
    id: 'testimonial',
    name: 'testimonial',
    displayName: 'Testimonial',
    description: 'Customer testimonials and reviews',
    source: 'system',
    schema: anyObject,
    settings: {
      baseGrants: { public: ['read'], admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
      maxVersionsPerRoot: 50,
    },
    queryableFields: [
      { name: 'rating',       kind: 'scalar', type: 'integer', column: 'q_tst_rating' },
      { name: 'authorCompany', kind: 'scalar', type: 'text',   column: 'q_tst_company' },
      { name: 'sortOrder',    kind: 'scalar', type: 'integer', column: 'q_tst_sort_order' },
    ],
  })

  await registry.register({
    id: 'contact_message',
    name: 'contact_message',
    displayName: 'Contact Message',
    description: 'Inbound contact form submissions',
    source: 'system',
    schema: anyObject,
    settings: {
      baseGrants: { admin: ['read', 'create', 'update', 'delete', 'manage'], editor: ['read'] },
      maxVersionsPerRoot: 10,
      pii: true,
    },
    queryableFields: [
      { name: 'reviewStatus', kind: 'scalar', type: 'text', column: 'q_msg_review' },
      { name: 'email',        kind: 'scalar', type: 'text', column: 'q_msg_email' },
    ],
  })

  // Blog posts: the existing code-managed `blog_posts` collection is backed by the document model
  // (Option B). The rich /admin/content collection editor stays; storage moves to documents. The
  // matching id ('blog_posts' == collection name) is how the content admin detects doc-backing.
  await registry.register({
    id: 'blog_posts',
    name: 'blog_posts',
    displayName: 'Blog Posts',
    description: 'Blog posts (document-backed; edited via the content collection UI)',
    source: 'system',
    schema: anyObject,
    settings: {
      baseGrants: { public: ['read'], admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
      maxVersionsPerRoot: 50,
    },
    queryableFields: [
      { name: 'difficulty', kind: 'scalar', type: 'text', column: 'q_blog_difficulty' },
      { name: 'author',     kind: 'scalar', type: 'text', column: 'q_blog_author' },
    ],
  })

  await registry.register({
    id: 'media_asset',
    name: 'media_asset',
    displayName: 'Media Asset',
    description: 'Uploaded files and images (metadata in D1, bytes in R2)',
    source: 'system',
    schema: anyObject,
    settings: {
      baseGrants: { public: ['read'], admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
      maxVersionsPerRoot: 5,
    },
    queryableFields: [
      { name: 'mimeType', kind: 'scalar', type: 'text',    column: 'q_media_mime' },
      { name: 'folder',   kind: 'scalar', type: 'text',    column: 'q_media_folder' },
      { name: 'size',     kind: 'scalar', type: 'integer', column: 'q_media_size' },
      { name: 'tags',     kind: 'facet',  type: 'text' },
    ],
  })
}

/**
 * Make EVERY content collection document-backed: register a document type whose id == the collection
 * name for each active user collection that doesn't already have one. After this, all content created
 * through /admin/content is stored in the `documents` table (the content admin detects doc-backing by
 * the matching id). Types registered here have no queryable generated columns (CRUD only) — a type can
 * be hand-tuned later (like blog_posts) to add filterable columns.
 *
 * Idempotent. Returns the collection names newly registered. Safe to call when the collections table
 * is absent (e.g. minimal test envs) — it no-ops. Run AFTER syncCollections so the table is populated.
 */
export async function autoRegisterCollectionDocumentTypes(db: D1Database): Promise<string[]> {
  const registry = new DocumentTypeRegistry(db)

  let collections: Array<{ name: string; display_name: string }> = []
  try {
    const res = await db
      .prepare("SELECT name, display_name FROM collections WHERE is_active = 1 AND (source_type IS NULL OR source_type = 'user')")
      .all<{ name: string; display_name: string }>()
    collections = res.results ?? []
  } catch {
    // collections table not present — fall through to code collections below
  }

  // Also register any code-defined collections (via registerCollections()) that
  // aren't already captured by the DB collections table above.
  try {
    const codeCollections = await loadCollectionConfigs()
    const dbNames = new Set(collections.map(c => c.name))
    for (const cc of codeCollections) {
      if (cc.name && !dbNames.has(cc.name)) {
        collections.push({ name: cc.name, display_name: cc.displayName })
      }
    }
  } catch {
    // collection-loader failure is non-fatal
  }

  const registered: string[] = []
  for (const col of collections) {
    if (!col.name) continue
    const existing = await registry.findById(col.name)
    if (existing) continue // already registered (e.g. blog_posts, faq, …) — keep its hand-tuned config
    await registry.register({
      id: col.name,
      name: col.name,
      displayName: col.display_name ?? col.name,
      description: `Document-backed collection (${col.name})`,
      source: 'system',
      schema: anyObject,
      settings: {
        baseGrants: { public: ['read'], admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
        maxVersionsPerRoot: 50,
      },
      queryableFields: [],
    })
    registered.push(col.name)
  }
  return registered
}
