/**
 * Hello Cruel World Plugin
 *
 * A heavily-commented "hello world" plugin for SonicJS v3. Its purpose is to
 * demonstrate every major extension point the plugin system provides:
 *
 *   1. Route registration       — public API + admin page
 *   2. Declarative menu entry   — shows up in the admin sidebar
 *   3. Hook subscriptions       — react to content and auth events
 *   4. configSchema             — auto-rendered settings form in the admin
 *   5. Lifecycle callbacks      — install / activate / deactivate / uninstall
 *   6. onBoot                   — async one-time setup per Worker isolate
 *
 * Read the comments top-to-bottom; they explain WHY each piece exists, not just
 * what it is.
 *
 * ── The v3 Plugin API ────────────────────────────────────────────────────────
 *
 * In SonicJS v3 every plugin is created with `definePlugin()`. Under the hood
 * definePlugin:
 *   - validates `id` and `version` (semver)
 *   - warns on unknown `capabilities`
 *   - wraps `onBoot` / `onCronTick` to inject a richer typed context
 *   - flattens the declarative `hooks` map into the wirable hooks array
 *   - returns an object that satisfies `MountablePlugin`, `WirablePlugin`, and
 *     `CronablePlugin` so the runtime never needs adapters
 *
 * ── Two-phase boot ───────────────────────────────────────────────────────────
 *
 * Cloudflare Workers start cold on the first request. The plugin system splits
 * work into two strict phases:
 *
 *   Phase 1 — register(app) — SYNCHRONOUS
 *     Mount routes and middleware. Hono locks its router after the first request
 *     so this MUST be sync and complete before any request arrives.
 *
 *   Phase 2 — onBoot(ctx) — ASYNC
 *     Run once after all plugins have registered (first request warm-up).
 *     Safe to await D1 queries, register dynamic hooks, or read env bindings.
 *
 * ── Capabilities ─────────────────────────────────────────────────────────────
 *
 * Capabilities gate access to optional services (email, R2 media, etc.). A
 * plugin that doesn't declare a capability can't accidentally call it — the
 * TypeScript type is `never` and the runtime throws. This plugin needs none.
 */

import { definePlugin, PluginServiceClass as PluginService } from '@sonicjs-cms/core'
import { createHelloCruelWorldApiRoutes } from './routes/api'
import { createHelloCruelWorldAdminRoutes } from './routes/admin'

// ── Plugin definition ─────────────────────────────────────────────────────────
//
// definePlugin<Caps>() is generic. The `Caps` type parameter captures the
// `capabilities` tuple so ctx.cap is narrowed at the author's call site.
// We omit capabilities entirely (defaults to readonly []) since this plugin
// needs no optional services.

export const helloCruelWorldPlugin = definePlugin({
  // ── Identity fields ─────────────────────────────────────────────────────────
  //
  // `id` is the stable machine key — used as the DB key for settings, the
  // settings URL segment (/admin/settings/plugins/:id), and dependency keys.
  // Use kebab-case. Never change this once the plugin ships.
  id: 'hello-cruel-world',

  // `name` is the human-readable display name in the admin UI.
  name: 'Hello Cruel World',

  // `version` must be valid semver (X.Y.Z). definePlugin warns if it isn't.
  version: '1.0.0',

  // `description` shows up in the plugin list and settings page header.
  description: 'A demo plugin that explains the SonicJS v3 plugin system.',

  // `sonicjsVersionRange` is a semver range checked against the running core
  // at registration. A mismatch logs a warning but never blocks activation —
  // plugins stay resilient by default.
  sonicjsVersionRange: '^3.0.0',

  // `author` appears in the plugin registry and manifest.
  author: {
    name: 'You',
    email: 'you@example.com',
    url: 'https://example.com',
  },

  // ── Route registration (SYNC) ─────────────────────────────────────────────
  //
  // `register(app)` is called synchronously during app setup, before any
  // request arrives. `app` is the root Hono instance — use app.route() to
  // mount sub-routers, or app.use() for middleware.
  //
  // IMPORTANT: Never await anything here. Never read env bindings here.
  // Async work belongs in onBoot().
  register(app) {
    // ── Why NOT /api/hello-cruel-world ────────────────────────────────────────
    //
    // User plugins are mounted in app.ts AFTER the core `/api` router, which
    // has a `/:collection` wildcard catch-all. In Hono, routes match in
    // registration order, so `/api/hello-cruel-world` would be swallowed by
    // `/:collection` → "Collection not found".
    //
    // Three options for a user plugin that needs a public API:
    //   a) Use a top-level path:   /hello-cruel-world  ← what we do here
    //   b) Coordinate with core to mount before the catch-all (core-plugin only)
    //   c) POST to /api/forms or another dedicated catch-all (plugin-provided)
    //
    // The public API is at /hello-cruel-world/* (no /api/ prefix).
    app.route('/hello-cruel-world', createHelloCruelWorldApiRoutes() as any)

    // Admin routes live under /admin/*, which also has a catch-all, but user
    // plugins are mounted BEFORE the /admin catch-all, so this works fine.
    app.route('/admin/hello-cruel-world', createHelloCruelWorldAdminRoutes() as any)
  },

  // ── Admin sidebar menu ────────────────────────────────────────────────────
  //
  // The `menu` array declares sidebar entries. The catalyst layout reads these
  // from the plugin menu singleton (populated by registerPlugins) and renders
  // them automatically — no per-plugin middleware needed.
  //
  // Fields:
  //   label       — displayed text
  //   path        — href (absolute from root)
  //   icon        — icon key understood by the catalyst icon renderer
  //   order       — sort position in the sidebar (lower = higher up)
  //   permissions — roles that can see this entry (admin, editor, etc.)
  menu: [
    {
      label: 'Hello Cruel World',
      path: '/admin/hello-cruel-world',
      // 'globe-alt' is one of the Heroicons names available in the catalyst UI.
      icon: 'globe-alt',
      // 90 puts this near the bottom of the sidebar, above the Settings item.
      order: 90,
      // Only admins see this. Remove 'admin' to make it visible to all roles.
      permissions: ['admin'],
    },
  ],

  // ── Declarative hook subscriptions ────────────────────────────────────────
  //
  // The `hooks` map is the declarative way to subscribe to typed lifecycle
  // events. Each key is a canonical event name from the hook catalog
  // (packages/core/src/plugins/hooks/catalog.ts), and the value is the
  // handler function.
  //
  // The TypeScript type of each handler is narrowed to its event's payload —
  // so `payload` here is `ContentEventPayload`, not `any`.
  //
  // Declarative hooks are registered during the wire phase (before the first
  // request). For dynamic / conditional subscriptions use `ctx.hooks.on()`
  // inside `onBoot` instead.
  hooks: {
    // Fired AFTER a content record is successfully created.
    // 'before' hooks (content:before:create) run before the write and can
    // mutate the payload or throw to cancel the operation.
    // 'after' hooks run post-commit and are for side effects only.
    'content:after:create': (payload) => {
      // `payload` is typed: { collection, id, data, user? }
      console.log(
        `[hello-cruel-world] New content created in collection "${payload.collection}"`,
        { id: payload.id, user: payload.user?.email ?? 'anonymous' }
      )
      // Returning void (or the payload unchanged) passes control to the next
      // registered handler for this event. Returning a modified payload
      // propagates the change to subsequent handlers.
    },

    // Fired AFTER a user completes self-registration.
    // payload is typed: { user: { id, email, role? } }
    'auth:registration:completed': (payload) => {
      console.log(
        `[hello-cruel-world] Welcome to the cruel world, ${payload.user.email}!`
      )
    },
  },

  // ── Async boot (ASYNC) ────────────────────────────────────────────────────
  //
  // `onBoot(ctx)` runs once per Worker isolate, on the first request, after
  // ALL plugins have completed their synchronous `register()` calls. This is
  // the right place for:
  //   - Reading env bindings (ctx.env.DB, ctx.env.KV, etc.)
  //   - Registering document types
  //   - Loading settings from the DB
  //   - Subscribing to hooks dynamically based on config
  //
  // `ctx` is the DefinedPluginContext — richer than the raw PluginBootContext:
  //   ctx.hooks   — typed hook facade (ctx.hooks.on / ctx.hooks.emit)
  //   ctx.cap     — capability-gated services (ctx.cap.email, etc.)
  //   ctx.env     — Worker env bindings (DB, KV, R2, secrets, etc.)
  //   ctx.raw     — the underlying PluginBootContext if you need the untyped form
  async onBoot(ctx) {
    // Logging here goes to the Wrangler console (local dev) or Cloudflare
    // Logpush in production. Use console.log sparingly in hot paths.
    console.log('[hello-cruel-world] Plugin booting...')

    // ── Self-register in the DB so /admin/plugins shows this plugin ────────
    //
    // The /admin/plugins list reads from two sources:
    //   1. PLUGIN_REGISTRY — auto-generated from manifest.json files in
    //      packages/core/src/plugins/ (core plugins only)
    //   2. PluginService.getAllPlugins() — documents of type 'plugin' in the DB
    //
    // User plugins registered via config.plugins.register are functionally
    // active (routes, hooks, onBoot all fire) but invisible to the list page
    // unless they appear in one of those sources.
    //
    // PluginService.ensurePlugin() is the idempotent escape hatch: it writes
    // a plugin document on first boot, then no-ops on subsequent warm-ups.
    // This makes the plugin visible in /admin/plugins without a manifest.json.
    const db = ctx.env?.DB as import('@cloudflare/workers-types').D1Database | undefined
    if (db) {
      try {
        const svc = new PluginService(db)

        // Ensure the plugin record exists (no-op if already present).
        await svc.ensurePlugin('hello-cruel-world', {
          displayName: 'Hello Cruel World',
          description: 'A demo plugin that explains the SonicJS v3 plugin system.',
          author: 'You',
          version: '1.0.0',
        })

        // ── Sync route metadata into plugin settings ───────────────────────
        //
        // The admin /admin/plugins/:id "Information" tab reads
        // plugin.settings._routes to render the route list automatically.
        // We store it in the DB settings JSON so the template never needs to
        // know about this specific plugin.
        //
        // Pattern for any plugin: merge _routes into existing settings on every
        // boot so the list stays in sync if routes are added/removed.
        //
        // _routes shape:
        //   method      — HTTP method (GET, POST, …)
        //   path        — full path as mounted on the root app
        //   description — what the route does
        //   requiresAuth — true = admin/session required; false = public
        const existing = await svc.getPlugin('hello-cruel-world')
        const existingSettings = (existing?.settings as Record<string, unknown>) ?? {}
        await svc.updatePluginSettings('hello-cruel-world', {
          ...existingSettings,  // preserve configSchema values (greeting, mood, etc.)
          _routes: [
            {
              method: 'GET',
              path: '/hello-cruel-world',
              description: 'Returns a JSON greeting message',
              requiresAuth: false,
            },
            {
              method: 'GET',
              path: '/hello-cruel-world/:name',
              description: 'Returns a personalised greeting for :name',
              requiresAuth: false,
            },
            {
              method: 'GET',
              path: '/admin/hello-cruel-world',
              description: 'Admin dashboard page for this plugin',
              requiresAuth: true,
            },
          ],
        })
      } catch (e) {
        // Non-fatal — plugin still works, just won't show in the list.
        console.warn('[hello-cruel-world] Could not self-register in DB:', e)
      }
    }

    // ── Reading env bindings ───────────────────────────────────────────────
    //
    // ctx.env is typed as Record<string,unknown> — cast to your expected type.
    // Workers bindings are defined in wrangler.toml:
    //   [[d1_databases]]
    //   binding = "DB"
    //   database_name = "sonicjs"
    //
    // This plugin doesn't need DB access (no document type, no table), so we
    // just demonstrate how to safely read an env var.
    const greetingEnvOverride = ctx.env?.HELLO_CRUEL_WORLD_GREETING as string | undefined

    if (greetingEnvOverride) {
      // An environment variable can override the plugin's default greeting.
      // In production this might come from a Workers secret or plain env var.
      console.log(
        `[hello-cruel-world] Greeting overridden by env var: "${greetingEnvOverride}"`
      )
    }

    // ── Dynamic hook subscription ─────────────────────────────────────────
    //
    // Use ctx.hooks.on() for subscriptions you only want to register under
    // certain conditions (e.g. only if a config value is set).
    //
    // This is equivalent to the declarative `hooks` map above but happens at
    // boot time so you can branch on env/config.
    ctx.hooks.on('content:after:update', (payload) => {
      // This fires on every content update. payload: ContentEventPayload
      console.log(
        `[hello-cruel-world] Content updated in "${payload.collection}" (id: ${payload.id})`
      )
    })

    console.log('[hello-cruel-world] Plugin ready.')
  },

  // ── configSchema — auto-rendered settings form ────────────────────────────
  //
  // Declaring `configSchema` tells the admin to auto-render a settings form
  // at /admin/settings/plugins/hello-cruel-world. No custom route or template
  // needed — the core renders the form from this schema, handles form
  // submission, parses FormData into typed values, and persists them.
  //
  // Field types: 'string' | 'number' | 'boolean' | 'select'
  // See packages/core/src/plugins/sdk/config-schema.ts for the full API.
  configSchema: {
    // Key = the settings key stored/loaded for this plugin.
    greeting: {
      type: 'string',
      label: 'Custom Greeting',
      description: 'The message returned by the /api/hello-cruel-world endpoint.',
      default: 'Hello, Cruel World!',
      placeholder: 'Hello, Cruel World!',
    },
    showTimestamp: {
      type: 'boolean',
      label: 'Show Timestamp in API Response',
      description: 'When enabled, the API response includes the current timestamp.',
      default: true,
    },
    mood: {
      type: 'select',
      label: 'Mood',
      description: 'Sets the emotional tone of the greeting (cosmetic only).',
      options: [
        { value: 'cruel', label: '😈 Cruel (default)' },
        { value: 'kind', label: '😇 Kind' },
        { value: 'indifferent', label: '😐 Indifferent' },
      ],
      default: 'cruel',
    },
  },

  // ── Lifecycle callbacks ───────────────────────────────────────────────────
  //
  // These are called by the plugin manager at specific lifecycle moments.
  // They are NOT called per-request — they run when an admin installs,
  // activates, deactivates, or uninstalls the plugin through the plugin
  // management UI.
  //
  // Common uses:
  //   install   — run DB migrations, create initial data
  //   uninstall — drop plugin tables, clean up data
  //   activate  — enable plugin features (flip a feature flag, warm a cache)
  //   deactivate — disable features without destroying data

  install: async () => {
    // Called once when an admin installs the plugin.
    // For a plugin with its own DB table you'd run migrations here.
    // This plugin stores nothing — the greeting lives in plugin config.
    console.log('[hello-cruel-world] Installed. No DB migrations needed.')
  },

  activate: async () => {
    // Called each time the plugin is activated (e.g. re-enabled after being
    // disabled). A good place to warm caches or start background jobs.
    console.log('[hello-cruel-world] Activated.')
  },

  deactivate: async () => {
    // Called when an admin disables the plugin. Routes stay mounted (the
    // Worker binary doesn't change at runtime), but you can stop background
    // work and invalidate caches here.
    console.log('[hello-cruel-world] Deactivated.')
  },

  uninstall: async () => {
    // Called when an admin removes the plugin entirely.
    // For a plugin with its own DB table you'd DROP TABLE here.
    console.log('[hello-cruel-world] Uninstalled.')
  },
})

// Re-export for consumers that import directly from this file (e.g. tests).
export default helloCruelWorldPlugin
