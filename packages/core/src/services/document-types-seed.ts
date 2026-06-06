import { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { DocumentTypeRegistry } from './document-type-registry'

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
      baseGrants: { admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
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
      baseGrants: { admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
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

  await registry.register({
    id: 'media_asset',
    name: 'media_asset',
    displayName: 'Media Asset',
    description: 'Uploaded files and images (metadata in D1, bytes in R2)',
    source: 'system',
    schema: anyObject,
    settings: {
      baseGrants: { admin: ['read', 'create', 'update', 'delete', 'publish', 'manage'], editor: ['read', 'create', 'update', 'publish'], viewer: ['read'] },
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
