/**
 * SonicJS Stats Collector
 *
 * Self-hosted telemetry collection using SonicJS
 * Tracks anonymous installation metrics
 */

import { createSonicJSApp, registerCollections } from '@sonicjs-cms/core'
import type { SonicJSConfig } from '@sonicjs-cms/core'

// Import collections
import installsCollection from './collections/installs.collection'
import eventsCollection from './collections/events.collection'

// Import plugins
import { statsDashboardPlugin } from './plugins/stats-dashboard'

// Register collections
registerCollections([
  installsCollection,
  eventsCollection,
])

// Application configuration
const config: SonicJSConfig = {
  collections: {
    autoSync: true
  },
  plugins: {
    autoLoad: false,
    register: [statsDashboardPlugin],
  }
}

const app = createSonicJSApp(config)

// Unauthenticated telemetry ingestion for create-sonicjs CLI.
// CLI posts to /v1/events; this handler writes directly to D1 bypassing ACL.
app.post('/v1/events', async (c) => {
  try {
    const body = await c.req.json<{ data?: Record<string, unknown> }>()
    const data = body.data ?? {}
    const { installation_id, event_type, properties, timestamp } = data as {
      installation_id?: string
      event_type?: string
      properties?: unknown
      timestamp?: string
    }

    if (!installation_id || !event_type) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = c.env.DB as D1Database
    const now = Math.floor(Date.now() / 1000)
    const id = crypto.randomUUID()
    const title = `${installation_id} - ${event_type}`

    await db.prepare(
      `INSERT INTO documents
         (id, root_id, type_id, is_published, status, title, data, published_at, created_at, updated_at)
       VALUES (?, ?, 'events', 1, 'published', ?, ?, ?, ?, ?)`
    ).bind(
      id, id, title,
      JSON.stringify({ installation_id, event_type, properties: properties ?? {}, timestamp: timestamp ?? new Date().toISOString() }),
      now, now, now
    ).run()

    return c.json({ success: true }, 201)
  } catch (_err) {
    // Telemetry must never block callers
    return c.json({ success: true }, 201)
  }
})

export default app
