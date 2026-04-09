# Stripe Subscription Plugin Implementation Plan

## Overview
A SonicJS plugin that handles Stripe subscription lifecycle via webhooks and exposes subscription status to the rest of the system. Tracks: GitHub Issue #760.

## Requirements
- [x] Stripe webhook endpoint with signature verification
- [x] Subscriptions database table
- [x] Checkout session creation for authenticated users
- [x] Subscription status API
- [x] Hook integration for subscription lifecycle events
- [x] Admin UI for subscription management
- [x] `requireSubscription()` middleware

## Technical Approach

### Architecture
Follows the existing SonicJS plugin pattern (PluginBuilder SDK). Modeled after the security-audit-plugin structure with separated routes, services, types, and components.

### File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/plugins/core-plugins/stripe-plugin/index.ts` | Create | Plugin factory and exports |
| `src/plugins/core-plugins/stripe-plugin/manifest.json` | Create | Plugin metadata |
| `src/plugins/core-plugins/stripe-plugin/types.ts` | Create | TypeScript types |
| `src/plugins/core-plugins/stripe-plugin/routes/api.ts` | Create | API routes (webhook, checkout, status) |
| `src/plugins/core-plugins/stripe-plugin/routes/admin.ts` | Create | Admin dashboard routes |
| `src/plugins/core-plugins/stripe-plugin/services/subscription-service.ts` | Create | DB operations for subscriptions |
| `src/plugins/core-plugins/stripe-plugin/services/stripe-api.ts` | Create | Stripe API wrapper |
| `src/plugins/core-plugins/stripe-plugin/middleware/require-subscription.ts` | Create | Subscription gate middleware |
| `src/plugins/core-plugins/stripe-plugin/components/subscriptions-page.ts` | Create | Admin subscriptions list |
| `src/plugins/core-plugins/index.ts` | Modify | Add stripe plugin exports |
| `src/app.ts` | Modify | Register stripe plugin routes |

### Database Changes
New `subscriptions` table via D1 migration in bootstrap:
- id, userId, stripeCustomerId, stripeSubscriptionId, stripePriceId
- status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd
- createdAt, updatedAt

### API Endpoints
- `POST /api/stripe/webhook` — Stripe webhook (no auth, signature verified)
- `POST /api/stripe/create-checkout-session` — Create checkout (auth required)
- `GET /api/stripe/subscription` — Current user subscription (auth required)
- `GET /admin/plugins/stripe` — Admin subscriptions dashboard (admin only)
- `GET /api/stripe/subscriptions` — List all subscriptions (admin only)

## Implementation Steps
1. Create types and manifest
2. Implement subscription service (DB layer)
3. Implement Stripe API wrapper
4. Implement webhook route with signature verification
5. Implement API routes (checkout, status)
6. Implement admin routes and dashboard component
7. Implement requireSubscription() middleware
8. Wire up plugin in index.ts, core-plugins/index.ts, app.ts
9. Verify TypeScript compilation

## Testing Strategy

### Unit Tests
- Webhook signature verification
- Subscription service CRUD operations
- Event type routing
- Middleware subscription check logic

### E2E Tests
- Webhook endpoint responds correctly to signed/unsigned requests
- Admin page renders subscription list
- API returns subscription status for authenticated user

## Risks & Considerations
- Webhook must use raw body for signature verification (not parsed JSON)
- Stripe SDK not available in CF Workers — use `fetch` directly against Stripe API
- Must handle idempotent webhook delivery (Stripe retries)
