import { PluginBuilder } from '../../sdk/plugin-builder'
import type { Plugin } from '../../types'
import { stripeAdminRoutes } from './routes/admin'
import { stripeApiRoutes } from './routes/api'

export function createStripePlugin(): Plugin {
  const builder = PluginBuilder.create({
    name: 'stripe',
    version: '1.0.0-beta.1',
    description: 'Stripe subscription management with webhook handling, checkout sessions, and subscription gating'
  })

  builder.metadata({
    author: { name: 'SonicJS Team' },
    license: 'MIT'
  })

  // Admin dashboard — subscription management
  builder.addRoute('/admin/plugins/stripe', stripeAdminRoutes as any, {
    description: 'Stripe subscriptions admin dashboard',
    requiresAuth: true,
    priority: 50
  })

  // API routes — webhook, checkout, subscription status
  builder.addRoute('/api/stripe', stripeApiRoutes as any, {
    description: 'Stripe API endpoints (webhook, checkout, subscription)',
    requiresAuth: false, // Webhook route handles its own auth via signature
    priority: 50
  })

  // Admin menu item
  builder.addMenuItem('Stripe', '/admin/plugins/stripe', {
    icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
    order: 75
  })

  // Lifecycle hooks
  builder.lifecycle({
    install: async () => {
      console.log('[Stripe] Plugin installed')
    },
    activate: async () => {
      console.log('[Stripe] Plugin activated')
    },
    deactivate: async () => {
      console.log('[Stripe] Plugin deactivated')
    },
    uninstall: async () => {
      console.log('[Stripe] Plugin uninstalled')
    }
  })

  return builder.build()
}

export const stripePlugin = createStripePlugin()
export { SubscriptionService } from './services/subscription-service'
export { StripeAPI } from './services/stripe-api'
export { requireSubscription } from './middleware/require-subscription'
export default stripePlugin
