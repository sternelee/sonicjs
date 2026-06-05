/**
 * Plugin capabilities
 *
 * A plugin declares the capabilities it needs (`capabilities: ['email:send']`).
 * The host then hands it a context whose powerful accessors are *gated* by those
 * declarations: reaching `ctx.email` without having declared `email:send` throws
 * `SonicCapabilityError` immediately, instead of failing deep inside a send.
 *
 * This is the isolation boundary that Strapi (namespacing only) and Payload (full
 * config access) don't have: capabilities make a plugin's blast radius explicit
 * and enforceable, and double as documentation of what a plugin can touch.
 *
 * Phase 1 vocabulary. Payment/queue/scheduled-fetch capabilities are intentionally
 * deferred to Phase 2 (see the overhaul plan §8.4 / open question 2).
 */

/**
 * Fixed capability names. `db:<table>` is parameterized (a plugin owns specific
 * tables), so it is matched by pattern rather than listed here.
 */
export const FIXED_CAPABILITIES = [
  'email:send',
  'cache:read',
  'cache:write',
  'media:read',
  'media:write',
  'http:fetch',
  'cron:register',
  'admin:menu',
  'hooks.auth:subscribe',
  'hooks.content:subscribe',
  // Reserved: gates subscription to the email event family once those events are
  // dispatched. Declared now so the canonical vocabulary is stable and the
  // Infowall rename target resolves.
  'hooks.email:subscribe',
] as const

export type FixedCapability = (typeof FIXED_CAPABILITIES)[number]

/** A scoped database capability, e.g. `db:email_log`. */
export type DbCapability = `db:${string}`

/** Any declarable capability. */
export type Capability = FixedCapability | DbCapability

const DB_CAPABILITY_RE = /^db:[a-zA-Z_][a-zA-Z0-9_]*$/

/** True if `name` is a recognized capability (fixed name or a valid `db:<table>`). */
export function isKnownCapability(name: string): name is Capability {
  return (FIXED_CAPABILITIES as readonly string[]).includes(name) || DB_CAPABILITY_RE.test(name)
}

/**
 * Thrown when a plugin uses a capability it did not declare.
 */
export class SonicCapabilityError extends Error {
  readonly capability: string
  readonly plugin?: string
  constructor(capability: string, plugin?: string) {
    super(
      `${plugin ? `Plugin "${plugin}"` : 'Plugin'} used capability "${capability}" without declaring it. ` +
        `Add "${capability}" to the plugin's capabilities.`
    )
    this.name = 'SonicCapabilityError'
    this.capability = capability
    this.plugin = plugin
  }
}

/** True if `capability` is in the granted set. */
export function hasCapability(granted: readonly string[], capability: string): boolean {
  return granted.includes(capability)
}

/**
 * Assert a capability is granted, throwing {@link SonicCapabilityError} otherwise.
 */
export function assertCapability(granted: readonly string[], capability: string, plugin?: string): void {
  if (!hasCapability(granted, capability)) {
    throw new SonicCapabilityError(capability, plugin)
  }
}

/**
 * Validate a plugin's declared capability list. Returns the unknown entries (empty
 * array = all valid). Callers decide whether to warn or hard-fail.
 *
 * Apply {@link normalizeCapabilities} first if the input may contain deprecated
 * spellings (e.g. from an older SDK or a sibling fork's manifest).
 */
export function validateCapabilities(declared: readonly string[]): string[] {
  return declared.filter((c) => !isKnownCapability(c))
}

// ── Capability rename / normalization (cross-version & cross-fork portability) ─
//
// Lets a plugin authored against a different/older SDK spelling load against the
// canonical vocabulary without code changes. The map is deprecated→canonical; it
// is applied before the known-capability check. Seeded with the sibling fork's
// (Infowall) spellings so plugins built there are portable here.

/* eslint-disable @typescript-eslint/naming-convention -- capability identifiers contain colons */
export const CAPABILITY_RENAMES = {
  // storage:* → media:* (this fork scopes the media library as `media`)
  'storage:read': 'media:read',
  'storage:write': 'media:write',
  // cron is a direct registration, not a hook subscription, here
  'hooks.cron:register': 'cron:register',
  // `:register` → `:subscribe` verb; content read/write granularity lives in the
  // event name (before/after), so both collapse to one subscription capability
  'hooks.auth:register': 'hooks.auth:subscribe',
  'hooks.content-read:register': 'hooks.content:subscribe',
  'hooks.content-write:register': 'hooks.content:subscribe',
  'hooks.email-events:register': 'hooks.email:subscribe',
  // NOTE: Infowall's `request:intercept` has no canonical target — there is no
  // middleware-insertion surface to gate yet, so it is intentionally absent
  // (a plugin declaring it will surface as unknown rather than silently no-op).
} as const satisfies Record<string, Capability>
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Resolve a (possibly deprecated) capability string to its canonical form, or
 * `null` if it is unknown after rename resolution. Renames apply first, then the
 * result is checked against the known vocabulary.
 */
export function normalizeCapability(input: string): Capability | null {
  const renamed: string = (CAPABILITY_RENAMES as Record<string, Capability>)[input] ?? input
  return isKnownCapability(renamed) ? (renamed as Capability) : null
}

/**
 * Normalize a list of capability strings. Returns the canonical capabilities plus
 * the inputs that remained unknown after rename resolution, so the caller can warn
 * (production) or reject (strict).
 */
export function normalizeCapabilities(declared: readonly string[]): {
  capabilities: Capability[]
  unknown: string[]
} {
  const capabilities: Capability[] = []
  const unknown: string[] = []
  for (const raw of declared) {
    const canonical = normalizeCapability(raw)
    if (canonical) {
      if (!capabilities.includes(canonical)) capabilities.push(canonical)
    } else {
      unknown.push(raw)
    }
  }
  return { capabilities, unknown }
}

// ── Capability-gated context ─────────────────────────────────────────────────

/** Provider factories for capability-backed accessors. Each is called lazily. */
export interface CapabilityProviders {
  email?: () => unknown
  cache?: () => unknown
  http?: () => unknown
}

/**
 * The gated context handed to a plugin. The accessors throw unless the backing
 * capability was declared; `has`/`require` allow explicit checks.
 */
export interface PluginCapabilityContext {
  /** The capabilities granted to this plugin. */
  readonly capabilities: readonly string[]
  /** True if the plugin declared `capability`. */
  has(capability: string): boolean
  /** Throw {@link SonicCapabilityError} unless `capability` was declared. */
  require(capability: string): void
  /** Email service. Throws unless `email:send` was declared (and a provider exists). */
  readonly email: unknown
  /** Cache service. Throws unless `cache:read` or `cache:write` was declared. */
  readonly cache: unknown
  /** Outbound fetch. Throws unless `http:fetch` was declared. */
  readonly http: unknown
}

/**
 * Build a capability-gated context.
 *
 * Accessors are lazy getters: they check the grant (and that a provider was
 * supplied) at access time, so merely constructing the context is cheap and
 * holding a reference to a capability you never use costs nothing.
 *
 * @param granted   Capabilities the plugin declared.
 * @param providers Backing service factories (only the granted ones get called).
 * @param plugin    Plugin name, for clearer errors.
 */
export function createCapabilityContext(
  granted: readonly string[],
  providers: CapabilityProviders = {},
  plugin?: string
): PluginCapabilityContext {
  const gate = (capability: string, anyOf: string[], provider: (() => unknown) | undefined): unknown => {
    const ok = anyOf.some((c) => hasCapability(granted, c))
    if (!ok) throw new SonicCapabilityError(capability, plugin)
    if (!provider) {
      throw new Error(
        `Capability "${capability}" is declared by ${plugin ?? 'the plugin'} but no provider was supplied by the host.`
      )
    }
    return provider()
  }

  const ctx: PluginCapabilityContext = {
    capabilities: [...granted],
    has: (capability) => hasCapability(granted, capability),
    require: (capability) => assertCapability(granted, capability, plugin),
    get email() {
      return gate('email:send', ['email:send'], providers.email)
    },
    get cache() {
      return gate('cache:read', ['cache:read', 'cache:write'], providers.cache)
    },
    get http() {
      return gate('http:fetch', ['http:fetch'], providers.http)
    },
  }
  return ctx
}
