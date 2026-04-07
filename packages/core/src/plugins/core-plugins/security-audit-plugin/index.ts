import { PluginBuilder } from '../../sdk/plugin-builder'
import type { Plugin } from '../../types'
import { securityAuditAdminRoutes } from './routes/admin'
import { securityAuditApiRoutes } from './routes/api'
import { securityAuditMiddleware } from './middleware/audit-middleware'

export function createSecurityAuditPlugin(): Plugin {
  const builder = PluginBuilder.create({
    name: 'security-audit',
    version: '1.0.0-beta.1',
    description: 'Security event logging, brute-force detection, and analytics dashboard'
  })

  builder.metadata({
    author: { name: 'SonicJS Team' },
    license: 'MIT'
  })

  // Admin dashboard and event log routes
  builder.addRoute('/admin/plugins/security-audit', securityAuditAdminRoutes as any, {
    description: 'Security audit dashboard and admin pages',
    requiresAuth: true,
    priority: 50
  })

  // API routes
  builder.addRoute('/api/security-audit', securityAuditApiRoutes as any, {
    description: 'Security audit API endpoints',
    requiresAuth: true,
    priority: 50
  })

  // Admin menu item — icon is raw SVG to match sidebar rendering
  builder.addMenuItem('Security', '/admin/plugins/security-audit', {
    icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
    order: 85
  })

  // Lifecycle hooks
  builder.lifecycle({
    install: async (context) => {
      console.log('[SecurityAudit] Plugin installed')
    },
    activate: async (context) => {
      console.log('[SecurityAudit] Plugin activated')
    },
    deactivate: async (context) => {
      console.log('[SecurityAudit] Plugin deactivated')
    },
    uninstall: async (context) => {
      console.log('[SecurityAudit] Plugin uninstalled')
    }
  })

  return builder.build()
}

export const securityAuditPlugin = createSecurityAuditPlugin()
export { SecurityAuditService } from './services/security-audit-service'
export { BruteForceDetector } from './services/brute-force-detector'
export { securityAuditMiddleware } from './middleware/audit-middleware'
export default securityAuditPlugin
