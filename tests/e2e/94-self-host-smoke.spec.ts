import { test, expect } from '@playwright/test'

/**
 * Self-Host Smoke Tests
 *
 * Validates the Docker / Node.js self-hosted server (non-Cloudflare deployment).
 * These tests run against a self-hosted instance started with `npm run self-host`.
 *
 * Set BASE_URL=http://localhost:3000 when running against a self-hosted instance.
 *
 * Covers:
 * - Health endpoint
 * - Sign-up and sign-in via better-auth credential flow
 * - Admin panel access after seeding
 * - Content and media routes reachable
 */

const SELF_HOST_EMAIL = process.env.SONICJS_ADMIN_EMAIL ?? 'admin@sonicjs.com'
const SELF_HOST_PASSWORD = process.env.SONICJS_ADMIN_PASSWORD ?? 'sonicjs!'

test.describe('Self-Host Smoke Tests', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // Self-host health check returns { status: 'ok' } (minimal)
    expect(body).toHaveProperty('status')
    expect(['ok', 'running']).toContain(body.status)
  })

  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/\/(admin\/login|auth\/login)/)
    expect(page.url()).toMatch(/login/)
  })

  test('sign-in with seeded admin credentials', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/login/)

    // Fill credentials
    const emailField = page.locator('input[type="email"], input[name="email"]').first()
    const passwordField = page.locator('input[type="password"], input[name="password"]').first()
    await emailField.fill(SELF_HOST_EMAIL)
    await passwordField.fill(SELF_HOST_PASSWORD)

    await page.locator('button[type="submit"], input[type="submit"]').first().click()

    // Should land on admin dashboard
    await page.waitForURL(/\/admin/, { timeout: 10_000 })
    expect(page.url()).toContain('/admin')

    // Should NOT still be on login
    expect(page.url()).not.toMatch(/login/)
  })

  test('admin content route accessible after sign-in', async ({ page, request }) => {
    // Sign in via API
    const signIn = await request.post('/auth/sign-in/email', {
      data: { email: SELF_HOST_EMAIL, password: SELF_HOST_PASSWORD },
    })
    expect(signIn.ok()).toBeTruthy()

    const cookies = signIn.headers()['set-cookie']
    expect(cookies).toBeTruthy()

    // Admin content page should return 200
    const content = await request.get('/admin/content')
    expect(content.ok()).toBeTruthy()
  })

  test('admin media route accessible after sign-in', async ({ request }) => {
    const signIn = await request.post('/auth/sign-in/email', {
      data: { email: SELF_HOST_EMAIL, password: SELF_HOST_PASSWORD },
    })
    expect(signIn.ok()).toBeTruthy()

    const media = await request.get('/admin/media')
    expect(media.ok()).toBeTruthy()
  })

  test('sign-up creates a new user (self-host allows registration)', async ({ request }) => {
    const unique = `e2e-${Date.now()}@test.sonicjs.local`
    const res = await request.post('/auth/sign-up/email', {
      data: {
        email: unique,
        password: 'TestPassword1!',
        name: 'E2E Test User',
      },
    })
    // 200 = success, 409 = already exists (idempotent re-run)
    expect([200, 409]).toContain(res.status())
  })
})
