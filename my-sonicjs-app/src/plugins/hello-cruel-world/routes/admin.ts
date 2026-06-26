/**
 * Hello Cruel World — Admin Routes
 *
 * Admin routes are mounted under /admin/* and rendered as HTML (server-side,
 * HTMX-compatible). SonicJS uses tagged template strings for HTML — no JSX,
 * no React. The admin layout wraps each page in the shared chrome (sidebar,
 * nav, etc.) so individual page templates only need to output the content area.
 *
 * Auth: admin routes should validate the session. For simplicity this demo
 * page doesn't gate on a role — real plugins call `requireAdmin(c)` or check
 * `c.get('user')` before returning sensitive content.
 */

import { Hono } from 'hono'

/**
 * createHelloCruelWorldAdminRoutes — returns the admin router.
 *
 * Mounted at /admin/hello-cruel-world by the plugin's register() call.
 * All paths here are relative to that prefix.
 */
export function createHelloCruelWorldAdminRoutes(options: { greeting?: string } = {}): Hono {
  const router = new Hono()

  // ── GET /admin/hello-cruel-world ────────────────────────────────────────────
  // The main admin dashboard page for this plugin.
  router.get('/', (c) => {
    const greeting = options.greeting ?? 'Hello, Cruel World!'

    // SonicJS admin pages return raw HTML strings. No JSX — just template
    // literals. The /* html */ comment is a VS Code hint for syntax highlighting.
    const html = /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hello Cruel World — SonicJS Admin</title>
  <!--
    Tailwind is available globally in the admin shell (loaded by the layout).
    Individual admin pages can rely on utility classes without importing Tailwind.
  -->
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen p-8">

  <!--
    Admin pages normally embed inside the shared admin layout (adminLayoutV2).
    For this demo we render a standalone page so you can see the full HTML
    without needing to wire in the layout dependencies.
    Real plugins import the layout template and wrap their content in it.
  -->

  <div class="max-w-2xl mx-auto">

    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Hello Cruel World</h1>
      <p class="text-gray-400 text-sm">
        A demo plugin for understanding the SonicJS v3 plugin system.
      </p>
    </div>

    <!-- Greeting card -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-white mb-3">Current Greeting</h2>
      <!--
        SECURITY NOTE: always escape user-controlled values before rendering them
        into HTML. The escapeHtml() utility from utils/sanitize handles this.
        This greeting comes from plugin config (admin-controlled) not raw user
        input, but the pattern is still good practice.
      -->
      <p class="text-2xl text-green-400 font-mono">${escapeForHtml(greeting)}</p>
    </div>

    <!-- Plugin anatomy explainer -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold text-white mb-3">How This Plugin Works</h2>
      <dl class="space-y-3 text-sm">
        <div>
          <dt class="text-gray-400 font-medium">Public API</dt>
          <dd class="text-gray-200 font-mono">GET /hello-cruel-world</dd>
          <dd class="text-gray-200 font-mono">GET /hello-cruel-world/:name</dd>
          <dd class="text-gray-500 text-xs mt-1">Note: /api/* prefix avoided — user plugins mount after the core /:collection catch-all.</dd>
        </div>
        <div>
          <dt class="text-gray-400 font-medium">Admin page</dt>
          <dd class="text-gray-200 font-mono">GET /admin/hello-cruel-world</dd>
        </div>
        <div>
          <dt class="text-gray-400 font-medium">Hook subscriptions</dt>
          <dd class="text-gray-200 font-mono">content:after:create (logs new content)</dd>
          <dd class="text-gray-200 font-mono">auth:registration:completed (logs new user)</dd>
        </div>
        <div>
          <dt class="text-gray-400 font-medium">Settings</dt>
          <dd class="text-gray-200 font-mono">/admin/settings/plugins/hello-cruel-world</dd>
        </div>
      </dl>
    </div>

    <!-- API test links -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-white mb-3">Try the API</h2>
      <div class="space-y-2">
        <a href="/hello-cruel-world"
           class="block text-blue-400 hover:text-blue-300 font-mono text-sm underline">
          GET /hello-cruel-world
        </a>
        <a href="/hello-cruel-world/traveller"
           class="block text-blue-400 hover:text-blue-300 font-mono text-sm underline">
          GET /hello-cruel-world/traveller
        </a>
      </div>
    </div>

    <div class="mt-6">
      <a href="/admin"
         class="text-gray-400 hover:text-white text-sm">
        &larr; Back to Admin
      </a>
    </div>
  </div>

</body>
</html>`

    // c.html() returns the string with Content-Type: text/html; charset=UTF-8
    return c.html(html)
  })

  return router
}

/**
 * Minimal HTML escaper — prevents XSS when interpolating values into HTML.
 *
 * In production plugins use escapeHtml from '@sonicjs-cms/core' (re-exported
 * from utils/sanitize). This copy lives here so the admin route file is
 * self-contained and easy to read as a learning example.
 */
function escapeForHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
