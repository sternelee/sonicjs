import { PluginBuilder } from '../../sdk/plugin-builder'
import type { Plugin } from '../../types'
import manifest from './manifest.json'
import { createTenantAdminRoutes } from './routes/admin'
import { invalidateTenantCache } from '../../../middleware/tenant'

export function createMultiTenantPlugin(): Plugin {
  const builder = PluginBuilder.create({
    name: manifest.id,
    version: manifest.version,
    description: manifest.description,
  })

  builder.metadata({
    author: { name: manifest.author },
    license: manifest.license,
    compatibility: '^2.0.0',
  })

  // Admin tenant management (self-gates on plugin activation; mounts before the /admin catch-all).
  builder.addRoute('/admin/tenants', createTenantAdminRoutes() as any, {
    description: 'Tenant management admin routes',
    requiresAuth: true,
    priority: 90,
  })

  builder.addMenuItem('Tenants', '/admin/tenants', {
    icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>`,
    order: 80,
  })

  // The admin UI toggle (PluginService) does not invoke these callbacks today, but keep them so a
  // direct lifecycle call still busts the per-isolate resolver cache. The settings/activation
  // writes also call invalidateTenantCache() directly (see PluginService).
  builder.lifecycle({
    activate: async () => {
      invalidateTenantCache()
      console.info('✅ Multi-Tenant plugin activated')
    },
    deactivate: async () => {
      invalidateTenantCache()
      console.info('❌ Multi-Tenant plugin deactivated')
    },
  })

  return builder.build()
}

export const multiTenantPlugin = createMultiTenantPlugin()
export { TenantService } from './services/tenant-service'
export default multiTenantPlugin
