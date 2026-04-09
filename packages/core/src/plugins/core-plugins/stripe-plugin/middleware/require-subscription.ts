import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../../../../app'
import { SubscriptionService } from '../services/subscription-service'

/**
 * Middleware that gates access to users with an active or trialing subscription.
 * Must be used after requireAuth() middleware.
 *
 * Usage:
 *   import { requireSubscription } from '../plugins/core-plugins/stripe-plugin'
 *   app.use('/premium/*', requireAuth(), requireSubscription())
 */
export function requireSubscription() {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = c.env.DB
    const subscriptionService = new SubscriptionService(db)

    try {
      await subscriptionService.ensureTable()
      const subscription = await subscriptionService.getByUserId(user.userId)

      if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
        return c.json({
          error: 'Active subscription required',
          subscription: subscription ? { status: subscription.status } : null
        }, 403)
      }

      // Proceed with the request
      return next()
    } catch (error) {
      console.error('[Stripe] Error checking subscription:', error)
      return c.json({ error: 'Subscription check failed' }, 500)
    }
  }
}
