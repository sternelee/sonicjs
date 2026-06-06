/**
 * Seed script: demo document model content
 *
 * Creates sample FAQ, Testimonial, and Contact Message documents
 * in the new document repository schema.
 *
 * Run from my-sonicjs-app/:
 *   npx tsx scripts/seed-documents.ts
 */

import { getPlatformProxy } from 'wrangler'
import { DocumentsService } from '../../packages/core/src/services/documents'
import { DocumentTypeRegistry } from '../../packages/core/src/services/document-type-registry'
import { bootstrapDocumentTypes } from '../../packages/core/src/services/document-types-seed'

async function seed() {
  const { env, dispose } = await getPlatformProxy()
  const db = (env as any).DB as D1Database

  if (!db) {
    console.error('❌ DB binding not found. Make sure wrangler.toml is configured.')
    process.exit(1)
  }

  try {
    // 1. Ensure document types are registered (idempotent).
    console.log('Registering document types...')
    await bootstrapDocumentTypes(db)
    console.log('✓ Document types ready')

    const registry = new DocumentTypeRegistry(db)

    // ─── FAQ documents ────────────────────────────────────────────────────────

    const faqType = await registry.findById('faq')
    if (!faqType) throw new Error('faq type not found after registration')

    const faqSvc = new DocumentsService(db, {
      queryableFields: faqType.queryableFields,
      typeSchemaVersion: faqType.schemaVersion,
      maxVersionsPerRoot: faqType.settings.maxVersionsPerRoot,
    })

    console.log('\nSeeding FAQ documents...')

    const faqs = [
      {
        title: 'What is SonicJS?',
        data: { question: 'What is SonicJS?', answer: 'SonicJS is a Cloudflare-native headless CMS built with Hono.js and TypeScript. It runs entirely on the edge using Cloudflare Workers, D1, and R2.', category: 'general', sortOrder: 1 },
        publish: true,
      },
      {
        title: 'How do I get started?',
        data: { question: 'How do I get started with SonicJS?', answer: 'Clone the repository, run `npm run workspace` to set up your database, then `npm run dev` to start the development server. Visit /admin to access the admin panel.', category: 'general', sortOrder: 2 },
        publish: true,
      },
      {
        title: 'What databases does SonicJS support?',
        data: { question: 'What databases does SonicJS support?', answer: 'SonicJS primarily uses Cloudflare D1 (SQLite) for structured data and Cloudflare R2 for file/object storage. The new document model extends D1 with a flexible JSON document store.', category: 'technical', sortOrder: 1 },
        publish: true,
      },
      {
        title: 'Is SonicJS open source?',
        data: { question: 'Is SonicJS open source?', answer: 'Yes! SonicJS is open source and available on GitHub. Contributions are welcome.', category: 'general', sortOrder: 3 },
        publish: true,
      },
      {
        title: 'How does the document model differ from collections?',
        data: { question: 'How does the document model differ from collections?', answer: 'Collections use plugin-specific SQL tables per content type. The document model uses a small shared schema (5 tables) with typed JSON payloads and indexed generated columns, so new content types require no migrations.', category: 'technical', sortOrder: 2 },
        publish: false,
      },
    ]

    for (const item of faqs) {
      const doc = await faqSvc.create({
        typeId: 'faq', tenantId: 'default', locale: 'default',
        title: item.title, data: item.data,
        parentRootId: '', sortOrder: item.data.sortOrder, visible: true,
        metadata: {}, publishOnCreate: false,
      }, 'seed')
      if (item.publish) await faqSvc.publish(doc.id, 'seed')
      console.log(`  ✓ ${item.title}${item.publish ? ' [published]' : ' [draft]'}`)
    }

    // ─── Testimonial documents ────────────────────────────────────────────────

    const tstType = await registry.findById('testimonial')
    if (!tstType) throw new Error('testimonial type not found')

    const tstSvc = new DocumentsService(db, {
      queryableFields: tstType.queryableFields,
      typeSchemaVersion: tstType.schemaVersion,
      maxVersionsPerRoot: tstType.settings.maxVersionsPerRoot,
    })

    console.log('\nSeeding Testimonial documents...')

    const testimonials = [
      {
        title: 'Jane Doe — Acme Corp',
        data: { authorName: 'Jane Doe', authorTitle: 'CTO', authorCompany: 'Acme Corp', testimonialText: 'SonicJS cut our CMS deployment time from days to hours. Running on Cloudflare Workers means zero cold starts and global low latency out of the box.', rating: 5, sortOrder: 1 },
        publish: true,
      },
      {
        title: 'Marcus Chen — Bright Labs',
        data: { authorName: 'Marcus Chen', authorTitle: 'Lead Engineer', authorCompany: 'Bright Labs', testimonialText: 'The plugin system is incredibly flexible. We extended SonicJS with a custom AI search plugin in under a day. The codebase is clean and well-structured.', rating: 5, sortOrder: 2 },
        publish: true,
      },
      {
        title: 'Sofia Martínez — Nova Digital',
        data: { authorName: 'Sofia Martínez', authorTitle: 'Product Manager', authorCompany: 'Nova Digital', testimonialText: 'Managing content through the admin UI is intuitive. The draft/publish workflow and live editing without taking pages offline is exactly what our team needed.', rating: 4, sortOrder: 3 },
        publish: true,
      },
      {
        title: 'Raj Patel — TechStartup',
        data: { authorName: 'Raj Patel', authorTitle: 'Founder', authorCompany: 'TechStartup', testimonialText: 'Very promising CMS. We are still evaluating but the Cloudflare-native approach is a clear differentiator. Looking forward to the media-as-document feature.', rating: 4, sortOrder: 4 },
        publish: false,
      },
    ]

    for (const item of testimonials) {
      const doc = await tstSvc.create({
        typeId: 'testimonial', tenantId: 'default', locale: 'default',
        title: item.title, data: item.data,
        parentRootId: '', sortOrder: item.data.sortOrder, visible: true,
        metadata: {}, publishOnCreate: false,
      }, 'seed')
      if (item.publish) await tstSvc.publish(doc.id, 'seed')
      console.log(`  ✓ ${item.title}${item.publish ? ' [published]' : ' [draft]'}`)
    }

    // ─── Contact Message documents ────────────────────────────────────────────

    const msgType = await registry.findById('contact_message')
    if (!msgType) throw new Error('contact_message type not found')

    const msgSvc = new DocumentsService(db, {
      queryableFields: msgType.queryableFields,
      typeSchemaVersion: msgType.schemaVersion,
      maxVersionsPerRoot: msgType.settings.maxVersionsPerRoot,
    })

    console.log('\nSeeding Contact Message documents...')

    const messages = [
      { title: 'Partnership enquiry — Alice Johnson', data: { name: 'Alice Johnson', email: 'alice@partnercorp.com', message: 'Hi, I am interested in partnering with SonicJS for our agency. We build Cloudflare-hosted sites for enterprise clients and would love to evaluate SonicJS as our default CMS. Can we set up a call?', ipAddress: '203.0.113.42', userAgent: 'Mozilla/5.0 (Macintosh)', reviewStatus: 'new' } },
      { title: 'Bug report — Bob Smith', data: { name: 'Bob Smith', email: 'bob@example.com', message: 'Found a potential issue with the CSRF middleware when using custom headers. Happy to provide a minimal reproduction case if helpful.', ipAddress: '198.51.100.7', userAgent: 'Mozilla/5.0 (Windows)', reviewStatus: 'reviewed' } },
      { title: 'Feature request — Carol White', data: { name: 'Carol White', email: 'carol@devshop.io', message: 'Would love to see webhooks on document publish/unpublish events. We need to trigger cache invalidation in our CDN when content changes.', ipAddress: '192.0.2.15', userAgent: 'Mozilla/5.0 (Linux)', reviewStatus: 'new' } },
    ]

    for (const item of messages) {
      await msgSvc.create({
        typeId: 'contact_message', tenantId: 'default', locale: 'default',
        title: item.title, data: item.data,
        parentRootId: '', sortOrder: 0, visible: true,
        metadata: {}, publishOnCreate: false,
      }, 'seed')
      console.log(`  ✓ ${item.title} [${item.data.reviewStatus}]`)
    }

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log('\n==========================================')
    console.log('✓ Document seeding complete!')
    console.log('')
    console.log('Browse the demo content at:')
    console.log('  /admin/documents/ui                — type selector')
    console.log('  /admin/documents/ui/faq            — 4 published, 1 draft')
    console.log('  /admin/documents/ui/testimonial    — 3 published, 1 draft')
    console.log('  /admin/documents/ui/contact_message — 3 draft messages')
    console.log('==========================================')
  } catch (error) {
    console.error('❌ Error seeding documents:', error)
    await dispose()
    process.exit(1)
  }

  await dispose()
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
