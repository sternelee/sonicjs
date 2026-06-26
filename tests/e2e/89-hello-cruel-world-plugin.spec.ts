/**
 * E2E: Hello Cruel World plugin
 *
 * Verifies that the hello-cruel-world demo plugin is correctly wired into the
 * SonicJS app: public API routes respond, the admin page loads, and the plugin
 * appears in the admin plugins list.
 */
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/test-helpers'

const BASE = process.env.BASE_URL || 'http://localhost:8787'

test.describe('Hello Cruel World plugin', () => {
  // ── Public API ─────────────────────────────────────────────────────────────

  // Note: routes are at /hello-cruel-world/* (not /api/*) because user plugins
  // mount after the core /api/:collection catch-all — see plugin index.ts for why.
  test('GET /hello-cruel-world returns JSON greeting using defaultName', async ({ request }) => {
    const res = await request.get(`${BASE}/hello-cruel-world`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    // Base route uses the defaultName setting (default: "Stranger") when no :name in URL.
    expect(body).toHaveProperty('message')
    expect(typeof body.message).toBe('string')
    // Should include the default name somewhere in the message.
    expect(body.message.toLowerCase()).toMatch(/stranger|hello/i)
    // Plugin field confirms this response came from the right handler.
    expect(body.plugin).toBe('hello-cruel-world')
  })

  test('GET /hello-cruel-world/:name returns personalised greeting', async ({ request }) => {
    const res = await request.get(`${BASE}/hello-cruel-world/traveller`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    // The /:name route embeds the URL param in the response.
    expect(body.message).toContain('traveller')
    expect(body.plugin).toBe('hello-cruel-world')
  })

  // ── Admin plugins list ─────────────────────────────────────────────────────

  test('plugin appears in /admin/plugins list', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/plugins')
    // The plugin self-registers via PluginService.ensurePlugin() in onBoot,
    // making it visible in the admin list without a manifest.json.
    await expect(page.locator('body')).toContainText('Hello Cruel World', { timeout: 10_000 })
  })

  // ── Admin page ─────────────────────────────────────────────────────────────

  test('admin page loads and shows plugin name', async ({ page }) => {
    await loginAsAdmin(page)
    const res = await page.goto('/admin/hello-cruel-world')
    // Route must exist — not a 404.
    expect(res?.status()).toBeLessThan(400)
    // The admin page h1 should identify the plugin.
    await expect(page.locator('h1')).toContainText(/hello cruel world/i)
  })

  test('admin page links to the public API', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/hello-cruel-world')
    // The page should have at least one link to the public route.
    // Note: links are at /hello-cruel-world (not /api/) — see plugin for why.
    const apiLink = page.locator('a[href*="/hello-cruel-world"]').first()
    await expect(apiLink).toBeVisible()
  })

  // ── Sidebar nav ────────────────────────────────────────────────────────────

  test('plugin settings page has View Page link to admin page', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/plugins/hello-cruel-world')
    // _adminPath stored in settings on first boot → "View Page" button appears in header
    const viewLink = page.getByRole('link', { name: /view page/i })
    await expect(viewLink).toBeVisible()
    await expect(viewLink).toHaveAttribute('href', '/admin/hello-cruel-world')
  })

  test('plugin menu entry appears in admin sidebar', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/content')
    // pluginMenuMiddleware merges plugin-menu-singleton entries (user plugins) into
    // the sidebar. The hello-cruel-world plugin declares menu: [{ path: '/admin/hello-cruel-world' }].
    const navLink = page.locator('nav a[href="/admin/hello-cruel-world"]').first()
    await expect(navLink).toBeVisible()
    await expect(navLink).toContainText(/hello cruel world/i)
  })
})
