/**
 * Hello Cruel World — Public API Routes
 *
 * Hono is SonicJS's HTTP framework. Each "route file" creates a small Hono app
 * (or returns one from a factory function) and exports it. The plugin's
 * `register(app)` call mounts these routes onto the root application.
 *
 * Route files are SYNCHRONOUS setup — they only wire up handlers, no async I/O.
 * Anything that needs env/DB access goes in the handler itself (called per-request)
 * or in the plugin's `onBoot` (called once per isolate warm-up).
 *
 * PATH NOTE: These routes are mounted at /hello-cruel-world (NOT /api/...).
 * User plugins mount after the core /api/:collection catch-all, so any
 * /api/your-plugin path would be swallowed by the collection handler. See
 * the plugin index.ts register() comment for the full explanation.
 */

import { Hono } from 'hono'

/**
 * createHelloCruelWorldApiRoutes — factory that returns the public API router.
 *
 * Factory pattern (vs. a plain exported Hono instance) lets you pass config from
 * the plugin into the routes without module-level globals. For this simple plugin
 * we just accept the optional `greeting` setting.
 */
export function createHelloCruelWorldApiRoutes(options: { greeting?: string } = {}): Hono {
  // A Hono instance is a mini router. We'll mount it at `/api/hello-cruel-world`
  // in the plugin's register() call, so the paths here are relative to that prefix.
  const router = new Hono()

  // ── GET /api/hello-cruel-world ───────────────────────────────────────────────
  // Returns a JSON greeting. c = Hono "Context" — wraps the raw Request and
  // provides helpers for building responses (c.json, c.text, c.html, etc.).
  router.get('/', (c) => {
    // c.req.raw is the underlying Web API Request if you ever need it.
    // c.json() serialises the object and sets Content-Type: application/json.
    return c.json({
      // The greeting comes from plugin configSchema settings (or a default).
      message: options.greeting ?? 'Hello, Cruel World!',
      // ISO timestamp so callers can see this is a fresh response, not cached.
      timestamp: new Date().toISOString(),
      // Metadata the caller can use to understand what plugin served this.
      plugin: 'hello-cruel-world',
    })
  })

  // ── GET /api/hello-cruel-world/:name ────────────────────────────────────────
  // Demonstrates URL parameters. :name is a path segment captured by Hono.
  router.get('/:name', (c) => {
    // c.req.param('name') reads the :name capture from the URL.
    const name = c.req.param('name')

    return c.json({
      // Personalise the greeting with the URL param.
      message: `Hello, ${name}! The world is still quite cruel.`,
      timestamp: new Date().toISOString(),
      plugin: 'hello-cruel-world',
    })
  })

  return router
}
