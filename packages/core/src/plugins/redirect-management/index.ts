/**
 * Redirect Management Plugin — Payload-shaped port.
 */

import { definePlugin } from '../sdk/define-plugin'
import manifest from './manifest.json'
import { RedirectService } from './services/redirect'
import { createRedirectAdminRoutes } from './routes/admin'
import { createRedirectApiRoutes } from './routes/api'

// Re-exports
export { createRedirectMiddleware, invalidateRedirectCache, warmRedirectCache } from './middleware/redirect'
export { createRedirectAdminRoutes } from './routes/admin'
export { createRedirectApiRoutes } from './routes/api'

let redirectService: RedirectService | null = null

export const redirectPlugin = definePlugin({
  id: manifest.id,
  version: manifest.version,
  name: manifest.name,
  description: manifest.description,
  sonicjsVersionRange: '^3.0.0',
  author: { name: manifest.author },

  register(app) {
    app.route('/admin/redirects', createRedirectAdminRoutes() as any)
    app.route('/api/redirects', createRedirectApiRoutes() as any)
  },

  menu: [
    { label: 'Redirects', path: '/admin/redirects', icon: 'bolt', order: 85, permissions: ['admin', 'redirect.manage'] },
  ],

  install: async (context: any) => {
    redirectService = new RedirectService(context.db)
    await redirectService.install()
    console.log('Redirect Management plugin installed successfully')
  },
  activate: async (context: any) => {
    redirectService = new RedirectService(context.db)
    await redirectService.activate()
    console.log('Redirect Management plugin activated')
  },
  deactivate: async (_context: any) => {
    if (redirectService) {
      await redirectService.deactivate()
      redirectService = null
    }
    console.log('Redirect Management plugin deactivated')
  },
  uninstall: async (_context: any) => {
    if (redirectService) {
      await redirectService.uninstall()
      redirectService = null
    }
    console.log('Redirect Management plugin uninstalled')
  },
})

export function createRedirectPlugin() {
  return redirectPlugin
}

export default redirectPlugin
