// Pure-logic coverage for the tenant resolution precedence (resolveTenantSlug). No DB needed —
// the resolver takes a snapshot of registry state + the request's header/cookie/host.
import { describe, it, expect } from 'vitest'
import { resolveTenantSlug } from '../../../../middleware/tenant'

function state(overrides: any = {}) {
  return {
    pluginActive: true,
    settings: { headerName: 'X-Tenant-Id', subdomainResolution: false, rootDomain: '' },
    tenants: new Map([
      ['default', { name: 'Default', status: 'active' }],
      ['acme', { name: 'Acme', status: 'active' }],
      ['beta', { name: 'Beta', status: 'active' }],
      ['frozen', { name: 'Frozen', status: 'inactive' }],
    ]),
    domains: new Map([['acme.example.com', 'acme']]),
    ...overrides,
  }
}

const req = (o: any = {}) => ({ header: undefined, cookie: undefined, host: undefined, ...o })

describe('resolveTenantSlug', () => {
  it('returns default when the plugin is inactive, ignoring all signals', () => {
    const s = state({ pluginActive: false })
    expect(resolveTenantSlug(s, req({ header: 'acme', cookie: 'beta', host: 'acme.example.com' }))).toBe('default')
  })

  it('header wins over cookie and host', () => {
    expect(resolveTenantSlug(state(), req({ header: 'acme', cookie: 'beta', host: 'beta.example.com' }))).toBe('acme')
  })

  it('cookie wins over host when no header', () => {
    expect(resolveTenantSlug(state(), req({ cookie: 'beta', host: 'acme.example.com' }))).toBe('beta')
  })

  it('exact domain mapping resolves when no header/cookie', () => {
    expect(resolveTenantSlug(state(), req({ host: 'acme.example.com' }))).toBe('acme')
  })

  it('host with port is normalized before domain match', () => {
    expect(resolveTenantSlug(state(), req({ host: 'acme.example.com:8787' }))).toBe('acme')
  })

  it('unknown header falls through to default (no leak)', () => {
    expect(resolveTenantSlug(state(), req({ header: 'ghost' }))).toBe('default')
  })

  it('inactive tenant is never resolved', () => {
    expect(resolveTenantSlug(state(), req({ header: 'frozen' }))).toBe('default')
    expect(resolveTenantSlug(state(), req({ cookie: 'frozen' }))).toBe('default')
  })

  it('subdomain resolution only applies when enabled and root domain is set', () => {
    const off = state()
    expect(resolveTenantSlug(off, req({ host: 'beta.example.com' }))).toBe('default')

    const on = state({ settings: { headerName: 'X-Tenant-Id', subdomainResolution: true, rootDomain: 'example.com' } })
    expect(resolveTenantSlug(on, req({ host: 'beta.example.com' }))).toBe('beta')
    // nested subdomain is not a single-label tenant → no match
    expect(resolveTenantSlug(on, req({ host: 'a.beta.example.com' }))).toBe('default')
    // unknown subdomain → default
    expect(resolveTenantSlug(on, req({ host: 'ghost.example.com' }))).toBe('default')
  })

  it('case-insensitive header/cookie matching', () => {
    expect(resolveTenantSlug(state(), req({ header: 'ACME' }))).toBe('acme')
    expect(resolveTenantSlug(state(), req({ cookie: 'Beta' }))).toBe('beta')
  })
})
