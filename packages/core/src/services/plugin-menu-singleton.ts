/**
 * Plugin admin-sidebar menu registry.
 *
 * Plugins declare `menu: PluginMenuEntry[]` on definePlugin. registerPlugins
 * collects every entry into this module singleton; the admin layout reads via
 * `resolvePluginMenuItems(user)` to render the sidebar.
 *
 * Phase 1 — strings + paths only. No custom React/HTMX components in menu
 * entries (icons are name strings looked up by the sidebar's icon map).
 */

export interface PluginMenuEntry {
  /** Display label. */
  label: string
  /** Admin URL the entry navigates to (e.g. `/admin/email`). */
  path: string
  /** Icon name from the admin icon map. Default: `puzzle-piece`. */
  icon?: string
  /** Sort key (ASC). Default 100. */
  order?: number
  /** Required permission slugs; if any matches the user's permissions, the entry is shown. */
  permissions?: readonly string[]
}

/**
 * Resolved entry — guaranteed `icon` + `order`, ready to render. Same shape
 * the catalyst sidebar consumes via `dynamicMenuItems`.
 */
export interface ResolvedPluginMenuEntry {
  label: string
  path: string
  icon: string
  order: number
}

let menuItems: readonly PluginMenuEntry[] = []

export function setPluginMenu(items: readonly PluginMenuEntry[]): void {
  menuItems = [...items]
}

export function getPluginMenu(): readonly PluginMenuEntry[] {
  return menuItems
}

export function resetPluginMenu(): void {
  menuItems = []
}

/**
 * Filter entries by user permissions, sort by `order` ASC, project to render-ready
 * shape with default icon. Pure function — same inputs, same output.
 *
 * Permission semantics: an entry with no `permissions` is always visible. An entry
 * with `permissions: ['x','y']` is visible if the user has ANY of `x` or `y`.
 */
export function resolvePluginMenuItems(
  user?: { permissions?: readonly string[] }
): ResolvedPluginMenuEntry[] {
  const userPerms = new Set(user?.permissions ?? [])
  return menuItems
    .filter((m) => {
      if (!m.permissions || m.permissions.length === 0) return true
      return m.permissions.some((p) => userPerms.has(p))
    })
    .slice()
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map((m) => ({
      label: m.label,
      path: m.path,
      icon: m.icon ?? 'puzzle-piece',
      order: m.order ?? 100,
    }))
}
