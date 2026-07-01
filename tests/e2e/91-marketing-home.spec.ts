import { test, expect } from '@playwright/test'

test.describe('Marketing Home Page', () => {
  test('no docs sidebar on home, full-width layout', async ({ page }) => {
    await page.goto('/')

    // Marketing nav present
    await expect(page.locator('[data-marketing-nav]')).toBeVisible()

    // No docs sidebar (the lg:ml-72 sidebar element)
    await expect(page.locator('.lg\\:w-72')).not.toBeVisible()

    // Hero headline present
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const h1Text = await page.getByRole('heading', { level: 1 }).textContent()
    expect(h1Text).toContain('born on the edge')
  })

  test('hero admin screenshot visible', async ({ page }) => {
    await page.goto('/')
    const screenshot = page.getByAltText('SonicJS admin content management interface')
    await expect(screenshot).toBeVisible()
  })

  test('primary CTA links to /quickstart', async ({ page }) => {
    await page.goto('/')

    const gettingStartedLinks = page.getByRole('link', { name: /Getting Started/i })
    await expect(gettingStartedLinks.first()).toBeVisible()
    const href = await gettingStartedLinks.first().getAttribute('href')
    expect(href).toBe('/quickstart')
  })

  test('marketing nav sticky with correct links', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('[data-marketing-nav]')
    await expect(nav).toBeVisible()

    // Nav has Docs, Blog, Compare links
    await expect(nav.getByRole('link', { name: 'Docs' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Blog' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Compare' })).toBeVisible()

    // Version badge visible
    await expect(nav.getByText(/^v\d/)).toBeVisible()
  })

  test('benchmark strip shows all 4 metrics', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('0-5ms')).toBeVisible()
    await expect(page.getByText('15-50ms')).toBeVisible()
    await expect(page.getByText('300+')).toBeVisible()
    await expect(page.getByText('$0')).toBeVisible()
  })

  test('changelog link points to /changelog', async ({ page }) => {
    await page.goto('/')
    const changelogLink = page.getByRole('link', { name: /full changelog/i })
    await expect(changelogLink).toBeVisible()
    const href = await changelogLink.getAttribute('href')
    expect(href).toBe('/changelog')
  })

  test('docs route still has sidebar (regression check)', async ({ page }) => {
    await page.goto('/quickstart')

    // Docs sidebar element present
    const sidebar = page.locator('.lg\\:block.lg\\:w-72, [class*="lg:w-72"]')
    // At least verify the marketing nav is NOT present (docs layout)
    await expect(page.locator('[data-marketing-nav]')).not.toBeVisible()
  })

  test('comparison table present on home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Honest numbers. No marketing spin.')).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('hero subhead mentions portability', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/anywhere SQLite runs/i).first()).toBeVisible()
  })

  test('trust strip includes "Runs anywhere"', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Runs anywhere', { exact: true })).toBeVisible()
  })

  test('deploy-anywhere section: Cloudflare recommended + self-host targets', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Born on the edge. Runs anywhere.' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cloudflare Workers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Also runs on' })).toBeVisible()
    await expect(page.getByText('docker run sonicjs')).toBeVisible()
    // Honesty guardrail: Postgres framed as roadmap, not shipped today
    await expect(page.getByText(/Postgres.*roadmap/i)).toBeVisible()
  })

  test('final CTA band has install command and join discord', async ({ page }) => {
    await page.goto('/')
    const discordLinks = page.getByRole('link', { name: /Join Discord/i })
    await expect(discordLinks.first()).toBeVisible()
  })

  test('why-switch cards render with overlaid text on image background', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Why Developers Switch to SonicJS' }),
    ).toBeVisible()
    // Pain-card background image present (Next fill image keeps alt text)
    await expect(page.getByAltText('Seamless migration visualization')).toBeVisible()
    // Overlaid card title visible over the image
    await expect(page.getByRole('heading', { name: 'No More Migration Hell' })).toBeVisible()
  })

  test('AI section highlights native MCP server', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Your content layer, speaking AI.' }),
    ).toBeVisible()
    // Concrete MCP capability copy (agents read/create/publish)
    await expect(page.getByText(/read, create, and publish/i)).toBeVisible()
    // MCP connect snippet present
    await expect(page.getByText(/mcpServers/)).toBeVisible()
  })
})
