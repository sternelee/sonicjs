// ============================================================================
// Stripe Plugin Types
// ============================================================================

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'incomplete_expired'

export interface Subscription {
  id: string
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripePriceId: string
  status: SubscriptionStatus
  currentPeriodStart: number
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
  createdAt: number
  updatedAt: number
}

export interface SubscriptionInsert {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripePriceId: string
  status: SubscriptionStatus
  currentPeriodStart: number
  currentPeriodEnd: number
  cancelAtPeriodEnd?: boolean
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus
  userId?: string
  stripeCustomerId?: string
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'updated_at' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface SubscriptionStats {
  total: number
  active: number
  canceled: number
  pastDue: number
  trialing: number
}

export interface StripePluginSettings {
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripePriceId?: string
  successUrl: string
  cancelUrl: string
}

export const DEFAULT_SETTINGS: StripePluginSettings = {
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  stripePriceId: '',
  successUrl: '/admin/dashboard',
  cancelUrl: '/admin/dashboard'
}

// Stripe webhook event types we handle
export type StripeWebhookEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'checkout.session.completed'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'

// Minimal Stripe types (we use fetch, not the SDK)
export interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, any>
  }
}

export interface StripeSubscriptionObject {
  id: string
  customer: string
  status: string
  items: {
    data: Array<{
      price: {
        id: string
      }
    }>
  }
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  metadata?: Record<string, string>
}

export interface StripeCheckoutSession {
  id: string
  customer: string
  subscription: string
  metadata?: Record<string, string>
}

export interface StripeInvoice {
  id: string
  customer: string
  subscription: string | null
  status: string
  amount_paid: number
  currency: string
}

// ============================================================================
// Stripe Events Log
// ============================================================================

export interface StripeEventRecord {
  id: string
  stripeEventId: string
  type: string
  objectId: string
  objectType: string
  data: string // JSON string
  processedAt: number
  status: 'processed' | 'failed' | 'ignored'
  error?: string
}

export interface StripeEventFilters {
  type?: string
  status?: 'processed' | 'failed' | 'ignored'
  objectId?: string
  page?: number
  limit?: number
}

export interface StripeEventStats {
  total: number
  processed: number
  failed: number
  ignored: number
}
