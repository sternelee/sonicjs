import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../app'
import type { Plugin } from '../plugins/types'

// All plugins that define menu items. The single source of truth for menu config
// is each plugin's addMenuItem() call — this array just lists which plugins to check.
import { securityAuditPlugin } from '../plugins/core-plugins/security-audit-plugin'

const MENU_PLUGINS: Plugin[] = [
  securityAuditPlugin,
]

const MARKER = '<!-- DYNAMIC_PLUGIN_MENU -->'

function renderMenuItem(item: { label: string; path: string; icon?: string }, currentPath: string): string {
  const isActive = currentPath === item.path || currentPath.startsWith(item.path)
  const fallbackIcon = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
  return `
    <span class="relative">
      ${isActive ? '<span class="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-cyan-500 dark:bg-cyan-400"></span>' : ''}
      <a
        href="${item.path}"
        class="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm/5 font-medium ${
          isActive
            ? 'text-zinc-950 dark:text-white'
            : 'text-zinc-950 hover:bg-zinc-950/5 dark:text-white dark:hover:bg-white/5'
        }"
        ${isActive ? 'data-current="true"' : ''}
      >
        <span class="shrink-0 ${isActive ? 'fill-zinc-950 dark:fill-white' : 'fill-zinc-500 dark:fill-zinc-400'}">
          ${item.icon || fallbackIcon}
        </span>
        <span class="truncate">${item.label}</span>
      </a>
    </span>`
}

export function pluginMenuMiddleware() {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const path = new URL(c.req.url).pathname
    if (!path.startsWith('/admin')) {
      return next()
    }

    // Collect menu items from active plugins
    let activeMenuItems: Array<{ label: string; path: string; icon?: string }> = []
    try {
      const db = c.env.DB
      const pluginNames = MENU_PLUGINS.map(p => p.name)
      if (pluginNames.length > 0) {
        const placeholders = pluginNames.map(() => '?').join(',')
        const result = await db.prepare(
          `SELECT name FROM plugins WHERE name IN (${placeholders}) AND status = 'active'`
        ).bind(...pluginNames).all()

        const activeNames = new Set((result.results || []).map((r: any) => r.name))

        for (const plugin of MENU_PLUGINS) {
          if (activeNames.has(plugin.name) && plugin.menuItems) {
            activeMenuItems.push(...plugin.menuItems)
          }
        }

        // Sort by order
        activeMenuItems.sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
      }
    } catch {
      // DB not ready or plugin table doesn't exist yet
    }

    c.set('pluginMenuItems', activeMenuItems.map(m => ({ label: m.label, path: m.path, icon: m.icon || '' })))

    await next()

    // Inject menu items into HTML response by replacing the marker
    if (activeMenuItems.length > 0 && c.res.headers.get('content-type')?.includes('text/html')) {
      const status = c.res.status
      const headers = new Headers(c.res.headers)
      const html = await c.res.text()

      if (html.includes(MARKER)) {
        const renderedItems = activeMenuItems.map(item => renderMenuItem(item, path)).join('')
        const newHtml = html.split(MARKER).join(renderedItems)
        c.res = new Response(newHtml, { status, headers })
      } else {
        // Body was consumed by .text(), must create new Response either way
        c.res = new Response(html, { status, headers })
      }
    }
  }
}
