import { Hono } from 'hono'
import { requireAuth } from '../../../../middleware'
import { PluginService } from '../../../../services'
import { SubscriptionService } from '../services/subscription-service'
import { renderSubscriptionsPage } from '../components/subscriptions-page'
import type { Bindings, Variables } from '../../../../app'
import type { StripePluginSettings, SubscriptionStatus } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminRoutes.use('*', requireAuth())

// Check admin role
adminRoutes.use('*', async (c, next) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.text('Access denied', 403)
  }
  return next()
})

async function getSettings(db: any): Promise<StripePluginSettings> {
  try {
    const pluginService = new PluginService(db)
    const plugin = await pluginService.getPlugin('stripe')
    if (plugin?.settings) {
      const settings = typeof plugin.settings === 'string' ? JSON.parse(plugin.settings) : plugin.settings
      return { ...DEFAULT_SETTINGS, ...settings }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

// Subscriptions dashboard
adminRoutes.get('/', async (c) => {
  const db = c.env.DB
  const subscriptionService = new SubscriptionService(db)
  await subscriptionService.ensureTable()

  const page = parseInt(c.req.query('page') || '1')
  const limit = 50
  const statusFilter = c.req.query('status') as SubscriptionStatus | undefined

  const [{ subscriptions, total }, stats] = await Promise.all([
    subscriptionService.list({ status: statusFilter, page, limit }),
    subscriptionService.getStats()
  ])

  const totalPages = Math.ceil(total / limit)

  const html = renderSubscriptionsPage(subscriptions as any, stats, {
    status: statusFilter,
    page,
    totalPages
  })

  return c.html(html)
})

// Save settings
adminRoutes.post('/settings', async (c) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB

    await db.prepare(`
      UPDATE plugins
      SET settings = ?,
          updated_at = unixepoch()
      WHERE id = 'stripe'
    `).bind(JSON.stringify(body)).run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Error saving Stripe settings:', error)
    return c.json({ success: false, error: 'Failed to save settings' }, 500)
  }
})

export { adminRoutes as stripeAdminRoutes }
