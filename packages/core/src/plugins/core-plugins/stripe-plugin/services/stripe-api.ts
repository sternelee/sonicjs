import type { StripePluginSettings } from '../types'

/**
 * Lightweight Stripe API client using fetch (CF Workers compatible, no SDK needed)
 */
export class StripeAPI {
  private baseUrl = 'https://api.stripe.com/v1'

  constructor(private secretKey: string) {}

  /**
   * Verify a webhook signature
   * Implements Stripe's v1 signature scheme using Web Crypto API
   */
  async verifyWebhookSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
    const parts = sigHeader.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const signatures = parts
      .filter(p => p.startsWith('v1='))
      .map(p => p.substring(3))

    if (!timestamp || signatures.length === 0) return false

    // Reject events older than 5 minutes (tolerance)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp)) > 300) return false

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return signatures.some(sig => timingSafeEqual(sig, expectedSignature))
  }

  /**
   * Create a Checkout Session
   */
  async createCheckoutSession(params: {
    priceId: string
    customerId?: string
    customerEmail?: string
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }): Promise<{ id: string; url: string }> {
    const body = new URLSearchParams()
    body.append('mode', 'subscription')
    body.append('line_items[0][price]', params.priceId)
    body.append('line_items[0][quantity]', '1')
    body.append('success_url', params.successUrl)
    body.append('cancel_url', params.cancelUrl)

    if (params.customerId) {
      body.append('customer', params.customerId)
    } else if (params.customerEmail) {
      body.append('customer_email', params.customerEmail)
    }

    if (params.metadata) {
      for (const [key, value] of Object.entries(params.metadata)) {
        body.append(`metadata[${key}]`, value)
      }
    }

    const response = await this.request('POST', '/checkout/sessions', body)
    return { id: response.id, url: response.url }
  }

  /**
   * Retrieve a Stripe subscription
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    return this.request('GET', `/subscriptions/${subscriptionId}`)
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(params: { email: string; metadata?: Record<string, string> }): Promise<{ id: string }> {
    const body = new URLSearchParams()
    body.append('email', params.email)
    if (params.metadata) {
      for (const [key, value] of Object.entries(params.metadata)) {
        body.append(`metadata[${key}]`, value)
      }
    }
    return this.request('POST', '/customers', body)
  }

  /**
   * Search for a customer by email
   */
  async findCustomerByEmail(email: string): Promise<{ id: string } | null> {
    const params = new URLSearchParams()
    params.append('query', `email:'${email}'`)
    params.append('limit', '1')
    const result = await this.request('GET', `/customers/search?${params.toString()}`)
    return result.data?.[0] || null
  }

  private async request(method: string, path: string, body?: URLSearchParams): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      ...(body ? { body: body.toString() } : {})
    })

    const data = await response.json() as any
    if (!response.ok) {
      throw new Error(`Stripe API error: ${data.error?.message || response.statusText}`)
    }
    return data
  }
}

/**
 * Constant-time string comparison to prevent timing attacks on signature verification
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
