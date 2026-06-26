/**
 * Hello Cruel World — Admin Routes
 *
 * Renders inside the shared admin layout (sidebar, nav, header) by calling
 * renderAdminLayoutCatalyst from @sonicjs-cms/core. This is the DEFAULT
 * pattern for plugin admin pages — provide inner `content` HTML only;
 * the layout owns <html>, <head>, <body>, sidebar, and nav chrome.
 *
 * Pattern (copy this for your own plugin):
 *   1. requireAuth() is applied by the core framework before this route fires.
 *   2. Pull user + pluginMenuItems from context.
 *   3. Build a `content` string — just the page body, no outer chrome.
 *   4. Call renderAdminLayoutCatalyst(layoutData) and return c.html(result).
 *
 * Gear icon:
 *   Every plugin admin page should include a gear icon linking to
 *   /admin/plugins/<id>#settings. Admins can then jump straight to the
 *   settings form without navigating through the Plugins list.
 *
 * Escape hatch:
 *   If you need a fully custom page (OAuth callback, print view, embedded
 *   widget), return c.html(<full HTML document>) without calling
 *   renderAdminLayoutCatalyst. That still works — it just bypasses the
 *   shared chrome.
 */

import { Hono } from 'hono'
import { renderAdminLayoutCatalyst, escapeHtml } from '@sonicjs-cms/core'
import type { AdminLayoutCatalystData } from '@sonicjs-cms/core'

export function createHelloCruelWorldAdminRoutes(options: { greeting?: string; defaultName?: string } = {}): Hono {
  const router = new Hono<any>()

  router.get('/', (c) => {
    const greeting = options.greeting ?? 'Hello, Cruel World!'
    const defaultName = options.defaultName ?? 'Stranger'
    const user = c.get('user') as { email: string; role: string } | undefined
    const dynamicMenuItems = c.get('pluginMenuItems') as Array<{ label: string; path: string; icon: string }> | undefined

    const content = `
      <div class="w-full px-4 sm:px-6 lg:px-8 py-6">

        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Hello Cruel World</h1>
            <p class="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">
              A demo plugin for understanding the SonicJS v3 plugin system.
            </p>
          </div>
          <a
            href="/admin/plugins/hello-cruel-world#settings"
            title="Plugin settings"
            class="inline-flex items-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Settings
          </a>
        </div>

        <div class="backdrop-blur-md bg-black/20 rounded-xl border border-white/10 shadow-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-white mb-3">Current Config</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex items-center gap-3">
              <dt class="text-gray-400 w-28 shrink-0">Greeting</dt>
              <dd class="text-green-400 font-mono">${escapeHtml(greeting)}</dd>
            </div>
            <div class="flex items-center gap-3">
              <dt class="text-gray-400 w-28 shrink-0">Default name</dt>
              <dd class="text-green-400 font-mono">${escapeHtml(defaultName)}</dd>
            </div>
          </dl>
          <p class="text-xs text-gray-500 mt-3">
            Try: <a href="/hello-cruel-world" class="text-blue-400 hover:text-blue-300 font-mono">/hello-cruel-world</a>
            → greets <span class="text-green-400 font-mono">${escapeHtml(defaultName)}</span>
          </p>
        </div>

        <div class="backdrop-blur-md bg-black/20 rounded-xl border border-white/10 shadow-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-white mb-3">How This Plugin Works</h2>
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-gray-400 font-medium">Public API</dt>
              <dd><a href="/hello-cruel-world" class="text-blue-400 hover:text-blue-300 font-mono">GET /hello-cruel-world</a></dd>
              <dd><a href="/hello-cruel-world/traveller" class="text-blue-400 hover:text-blue-300 font-mono">GET /hello-cruel-world/traveller</a></dd>
              <dd class="text-gray-500 text-xs mt-1">Routes at /hello-cruel-world/* not /api/* — user plugins mount after the core /:collection catch-all.</dd>
            </div>
            <div>
              <dt class="text-gray-400 font-medium">Admin page</dt>
              <dd class="text-gray-200 font-mono">GET /admin/hello-cruel-world</dd>
            </div>
            <div>
              <dt class="text-gray-400 font-medium">Hook subscriptions</dt>
              <dd class="text-gray-200 font-mono">content:after:create</dd>
              <dd class="text-gray-200 font-mono">auth:registration:completed</dd>
            </div>
            <div>
              <dt class="text-gray-400 font-medium">Settings</dt>
              <dd><a href="/admin/plugins/hello-cruel-world#settings" class="text-blue-400 hover:text-blue-300 font-mono">/admin/plugins/hello-cruel-world#settings</a></dd>
            </div>
          </dl>
        </div>

        ${user ? `
        <div class="backdrop-blur-md bg-black/20 rounded-xl border border-white/10 p-4 text-sm text-gray-400">
          Logged in as <span class="text-white font-medium">${escapeHtml(user.email)}</span>
          <span class="ml-2 text-xs text-gray-500">(${escapeHtml(user.role)})</span>
        </div>
        ` : ''}

      </div>
    `

    const layoutData: AdminLayoutCatalystData = {
      title: 'Hello Cruel World',
      pageTitle: 'Hello Cruel World',
      currentPath: '/admin/hello-cruel-world',
      content,
      ...(user ? { user: { name: user.email, email: user.email, role: user.role } } : {}),
      ...(dynamicMenuItems ? { dynamicMenuItems } : {}),
    }

    return c.html(renderAdminLayoutCatalyst(layoutData))
  })

  return router
}
