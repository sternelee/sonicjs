export { H as HookSystemImpl, a as HookUtils, P as PluginManager, b as PluginRegistryImpl, c as PluginValidator, S as ScopedHookSystem } from './plugin-manager-BoM3Q7o7.cjs';
import * as hono from 'hono';
import { Hono, Context, Next } from 'hono';
import { D1Database } from '@cloudflare/workers-types';
import './plugin-DDYetMF-.cjs';
import 'zod';

/**
 * Plugin route mounting primitive
 *
 * This is the shared, position-aware primitive that mounts plugin routes into
 * the Hono app. It replaces the hand-wired, copy-pasted
 * `if (plugin.routes) { for (...) app.route(...) }` blocks that previously lived
 * in `app.ts`.
 *
 * ## Why synchronous
 *
 * Hono's `SmartRouter` builds (and then locks) its match tree on the first
 * request. Calling `app.route()` after that throws:
 *
 *   `Error: Can not add a route since the matcher is already built`
 *
 * Therefore route mounting MUST happen synchronously at app-construction time,
 * before any request is served. A plugin's imperative `register(app)` hook is
 * held to the same contract: returning a Promise is a hard error
 * (`PluginRegisterMustBeSyncError`) rather than a silent hang. Asynchronous,
 * env-dependent work (hook subscriptions, services, crons) belongs in a later
 * lazy "wire" phase — not here.
 *
 * ## Position-awareness
 *
 * Plugin routes must be mounted BEFORE the bare `/admin` catch-all so that a
 * plugin's own `/admin/<x>` pages are not shadowed. Callers are responsible for
 * invoking `registerPluginRoutes()` at the correct position in `app.ts`; this
 * module just performs the mounting deterministically.
 */

/**
 * Minimal structural contract this module needs to mount a plugin.
 *
 * Deliberately NOT the full `Plugin` interface: the core plugins are typed
 * against the built `@sonicjs-cms/core` `dist` declarations, while this file
 * lives in `src`, and TypeScript treats those two `Plugin` types as distinct
 * nominal identities. Accepting a structural subset lets both the `src` and
 * `dist` `Plugin` shapes (and user-supplied plugins) be mounted without casts,
 * and keeps `mount.ts` honest about what it actually reads.
 */
interface MountableRoute {
    path: string;
    handler: unknown;
    priority?: number;
}
interface MountablePlugin {
    name?: string;
    routes?: MountableRoute[];
    /** Synchronous imperative route registration. A Promise return is rejected. */
    register?: (app: any) => unknown;
}
/**
 * Thrown when a plugin's `register(app)` hook returns a Promise.
 *
 * `register()` runs synchronously at construction time (see module docs). Move
 * any async work to a lifecycle hook (`install`/`activate`) or the async wiring
 * phase instead.
 */
declare class PluginRegisterMustBeSyncError extends Error {
    constructor(pluginName: string);
}
/** A single mounted route, for diagnostics/introspection. */
interface MountedRoute {
    plugin: string;
    path: string;
}
/** Outcome of a mount pass. */
interface MountResult {
    /** Routes successfully mounted, in mount order. */
    mounted: MountedRoute[];
    /** Plugins (or routes) skipped, with a human-readable reason. */
    skipped: Array<{
        plugin: string;
        reason: string;
    }>;
}
type AnyHono = Hono<any, any, any>;
/**
 * Mount a single plugin's routes into `app`.
 *
 * Applies, in order:
 *  1. The plugin's declarative `routes[]` (sorted by priority), and
 *  2. The plugin's imperative `register(app)` hook, if present (sync-guarded).
 *
 * @param app    Host Hono app (mount BEFORE the `/admin` catch-all).
 * @param plugin Plugin to mount.
 * @param result Optional accumulator for diagnostics.
 */
declare function mountPlugin(app: AnyHono, plugin: MountablePlugin, result?: MountResult): void;
/** Options for {@link registerPluginRoutes}. */
interface RegisterPluginRoutesOptions {
    /**
     * Label used in dev warnings (e.g. `'core'` or `'user'`). Purely cosmetic.
     */
    source?: string;
    /**
     * When true, log a warning if two plugins mount the exact same route path
     * (later registration is shadowed by Hono's first-match semantics). Defaults
     * to true in non-production.
     */
    warnOnDuplicatePath?: boolean;
}
/**
 * Mount a list of plugins into `app`, in array order.
 *
 * This is the generic replacement for the hand-wired plugin blocks. Plugins are
 * mounted in the order given (the caller decides ordering — typically core
 * plugins first, then user `plugins.register` plugins), each before the bare
 * `/admin` catch-all.
 *
 * Invalid entries are skipped (recorded in the result) rather than throwing, so
 * one malformed plugin can't take down the whole app. The one hard error is a
 * plugin whose `register()` is asynchronous — that is a contract violation that
 * must surface loudly.
 *
 * @returns A {@link MountResult} describing what was mounted/skipped.
 */
declare function registerPluginRoutes(app: AnyHono, plugins: Array<MountablePlugin | undefined | null>, options?: RegisterPluginRoutesOptions): MountResult;

/**
 * Typed hook event catalog
 *
 * The single source of truth for which lifecycle events a plugin may subscribe
 * to, and the payload shape each one carries. Subscribing through the typed
 * facade (`createTypedHooks`) gives a plugin the narrowed payload type with no
 * casting — TypeScript rejects a wrong field name at the `.on()` call site.
 *
 * Scope note: this catalog lists the events that are (or are being) dispatched
 * in production. The legacy string-keyed `HOOKS` map in `../types` declared many
 * more events than were ever fired; reconciling that list down to what actually
 * dispatches is tracked in the plugin-overhaul plan. Add an event here only when
 * a real dispatch site exists (or is landing in the same change).
 */
/** Common shape for content lifecycle events. */
interface ContentEventPayload {
    /** Collection / content-type slug the event is about. */
    collection: string;
    /** Content row id, when known (absent for pre-create events). */
    id?: string;
    /** The content data being read/written. Mutable by handlers in the chain. */
    data: Record<string, unknown>;
    /** The acting user, when the event originates from an authenticated request. */
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}
/** Emitted after a user completes self-registration. */
interface AuthRegistrationCompletedPayload {
    user: {
        id: string;
        email: string;
        role: string;
    };
}
/** Emitted when a password reset is requested (carries the reset token internally). */
interface AuthPasswordResetRequestedPayload {
    user: {
        id: string;
        email: string;
    };
    /** Single-use reset token. Never expose this in an API response. */
    resetToken: string;
}
/** Emitted after a password reset is confirmed. */
interface AuthPasswordResetCompletedPayload {
    user: {
        id: string;
        email: string;
    };
}
/**
 * The catalog: event name → payload type.
 *
 * Keep keys in sync with `HookEventName` (derived below) and with the dispatch
 * sites. This is an interface (not a const) so it participates in type-level
 * lookups and can be augmented via declaration merging if a downstream package
 * needs to extend it.
 */
interface HookEventPayloads {
    'content:read': ContentEventPayload;
    'content:create': ContentEventPayload;
    'content:update': ContentEventPayload;
    'content:delete': ContentEventPayload;
    'content:publish': ContentEventPayload;
    'content:save': ContentEventPayload;
    'auth:registration:completed': AuthRegistrationCompletedPayload;
    'auth:password-reset:requested': AuthPasswordResetRequestedPayload;
    'auth:password-reset:completed': AuthPasswordResetCompletedPayload;
}
/** Union of all catalog event names. */
type HookEventName = keyof HookEventPayloads;
/** The payload type for a given event name. */
type HookPayload<E extends HookEventName> = HookEventPayloads[E];
/**
 * Runtime list of catalog event names.
 *
 * Useful for validation (e.g. "is this a known event?") and for diagnostics.
 * Kept as a typed tuple so it can't silently drift from the interface: any new
 * key added to `HookEventPayloads` should be added here too, and the
 * `satisfies` check below fails the build if the list references an unknown
 * event.
 */
declare const HOOK_EVENT_NAMES: readonly ["content:read", "content:create", "content:update", "content:delete", "content:publish", "content:save", "auth:registration:completed", "auth:password-reset:requested", "auth:password-reset:completed"];
/** True if `name` is a known catalog event. */
declare function isKnownHookEvent(name: string): name is HookEventName;

/**
 * Typed hook facade
 *
 * Wraps the (string-keyed, untyped) hook system in a catalog-aware API:
 *
 *   const hooks = createTypedHooks(hookSystem)
 *   hooks.on('auth:registration:completed', (payload) => {
 *     payload.user.email   // ✓ narrowed — no cast
 *     payload.user.nope    // ✗ type error
 *   })
 *   await hooks.dispatch('auth:registration:completed', { user: {...} })
 *
 * The facade is intentionally structural about the underlying hook system (see
 * `HookSystemLike`) so both `HookSystemImpl` and `ScopedHookSystem` — and the
 * `src`/`dist` duplicate type identities — all satisfy it without casts.
 */

/**
 * Minimal structural contract the typed facade needs from a hook system.
 * Satisfied by `HookSystemImpl` and `ScopedHookSystem`.
 */
interface HookSystemLike {
    register(hookName: string, handler: (data: any, context: any) => any, priority?: number): void;
    execute(hookName: string, data: any, context?: any): Promise<any>;
    unregister?(hookName: string, handler: (data: any, context: any) => any): void;
}
/** Context passed to a typed hook handler (kept loose; mirrors the legacy HookContext). */
interface TypedHookContext {
    /** Plugin that registered the hook, if known. */
    plugin?: string;
    /** Cancel the remaining hook chain. */
    cancel?: () => void;
    [key: string]: unknown;
}
/**
 * A typed hook handler. May mutate and return the payload (threaded to the next
 * handler), or return nothing (the current payload is preserved).
 */
type TypedHookHandler<E extends HookEventName> = (payload: HookPayload<E>, context: TypedHookContext) => HookPayload<E> | void | Promise<HookPayload<E> | void>;
interface TypedHooks {
    /**
     * Subscribe to a catalog event. Lower priority runs earlier (matches the
     * underlying hook system; default 10).
     */
    on<E extends HookEventName>(event: E, handler: TypedHookHandler<E>, priority?: number): void;
    /**
     * Dispatch a catalog event through the handler chain. Returns the (possibly
     * mutated) payload after all handlers run.
     */
    dispatch<E extends HookEventName>(event: E, payload: HookPayload<E>, context?: TypedHookContext): Promise<HookPayload<E>>;
}
/**
 * Build a typed facade over a hook system.
 *
 * `on()` wraps the typed handler so that returning `void` preserves the current
 * payload in the chain (the underlying `execute()` threads whatever each handler
 * returns, so we coalesce `undefined` back to the incoming data).
 */
declare function createTypedHooks(hookSystem: HookSystemLike): TypedHooks;

/**
 * Hook-system singleton
 *
 * Gives env-independent access to the app's hook system. Code that runs outside
 * the HTTP request context — most importantly scheduled (cron) handlers, which
 * have no per-request `c.env` — needs a way to reach the hook system without
 * threading it through every call. The app sets the singleton eagerly at
 * construction; everything else reads it.
 *
 * Contract: `getHookSystem()` throws if read before the app has set one
 * (throw-before-get), which surfaces wiring-order bugs loudly instead of
 * silently no-oping. `setHookSystem()` is idempotent (last write wins) so that
 * constructing multiple apps in one process — e.g. across tests — does not
 * throw; call `resetHookSystem()` in test teardown for isolation.
 */

/** Set the process-wide hook system. Last write wins. */
declare function setHookSystem(hookSystem: HookSystemLike): void;
/**
 * Get the process-wide hook system.
 * @throws if no hook system has been set yet.
 */
declare function getHookSystem(): HookSystemLike;
/** True if a hook system has been set. */
declare function hasHookSystem(): boolean;
/** Clear the singleton. Intended for test isolation. */
declare function resetHookSystem(): void;
/** Convenience: a typed facade over the current singleton hook system. */
declare function getTypedHooks(): TypedHooks;

/**
 * Plugin wiring phase (the async half of two-phase boot)
 *
 * Route mounting is synchronous and happens at construction (see `mount.ts`).
 * Everything that needs the runtime environment — hook subscriptions and the
 * `onBoot` lifecycle — happens here, lazily, on the first request, after every
 * plugin has registered. Splitting the two avoids Hono's "matcher already built"
 * lock (routes must mount before the first request; env-dependent wiring can
 * only run once a request supplies `c.env`).
 *
 * This module is the wiring mechanism. Where/when it is invoked (a once-guarded
 * first-request step) is the caller's concern; `createPluginWirer()` provides
 * the once-guard.
 */

/** A hook subscription declared by a plugin (the legacy `hooks[]` shape). */
interface WirableHook {
    name: string;
    handler: (data: any, context: any) => any;
    priority?: number;
}
/**
 * Structural contract this module needs from a plugin. Deliberately minimal (and
 * not the full `Plugin` interface) so the `src`/`dist` duplicate `Plugin`
 * identities and user-supplied plugins all satisfy it without casts.
 */
interface WirablePlugin {
    name?: string;
    hooks?: WirableHook[];
    /**
     * Async lifecycle hook run once, after all plugins have registered and their
     * hooks are subscribed. The place for env-dependent setup (services, seeding,
     * cron registration). Errors are isolated per-plugin.
     */
    onBoot?: (context: PluginBootContext) => void | Promise<void>;
}
/** Context handed to `onBoot`. Kept loose; concrete bindings are filled by the host. */
interface PluginBootContext {
    /** The live hook system (already carrying every plugin's subscriptions). */
    hooks: HookSystemLike;
    /** Runtime bindings, when available. */
    env?: Record<string, unknown>;
    [key: string]: unknown;
}
/** Outcome of a wiring pass. */
interface WireResult {
    /** Total hook subscriptions registered. */
    subscribed: number;
    /** Names of plugins whose `onBoot` completed successfully. */
    booted: string[];
    /** Per-plugin errors (wiring never throws; one bad plugin can't break boot). */
    errors: Array<{
        plugin: string;
        phase: 'subscribe' | 'onBoot';
        error: unknown;
    }>;
}
/**
 * Subscribe every plugin's declarative `hooks[]` to the live hook system, then
 * run each plugin's `onBoot`, in array order.
 *
 * Subscriptions happen for ALL plugins first, so that one plugin's `onBoot` can
 * rely on another plugin's hooks already being registered. Per-plugin errors are
 * captured in the result rather than thrown.
 */
declare function wireRegisteredPlugins(plugins: Array<WirablePlugin | undefined | null>, context: PluginBootContext): Promise<WireResult>;
/**
 * Wrap {@link wireRegisteredPlugins} in a once-guard.
 *
 * The returned function runs the wiring at most once per process: the first call
 * starts it and caches the promise; every later call returns that same promise.
 * This is the first-request trigger — many concurrent first requests all await
 * one wiring pass.
 *
 * @param plugins     Plugins to wire (evaluated lazily at first call).
 * @param ctxFactory  Builds the boot context at first-call time (so it can read
 *                    per-request env).
 */
declare function createPluginWirer(plugins: Array<WirablePlugin | undefined | null> | (() => Array<WirablePlugin | undefined | null>), ctxFactory: () => PluginBootContext): () => Promise<WireResult>;

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
declare const FIXED_CAPABILITIES: readonly ["email:send", "cache:read", "cache:write", "media:read", "media:write", "http:fetch", "cron:register", "admin:menu", "hooks.auth:subscribe", "hooks.content:subscribe"];
type FixedCapability = (typeof FIXED_CAPABILITIES)[number];
/** A scoped database capability, e.g. `db:email_log`. */
type DbCapability = `db:${string}`;
/** Any declarable capability. */
type Capability = FixedCapability | DbCapability;
/** True if `name` is a recognized capability (fixed name or a valid `db:<table>`). */
declare function isKnownCapability(name: string): name is Capability;
/**
 * Thrown when a plugin uses a capability it did not declare.
 */
declare class SonicCapabilityError extends Error {
    readonly capability: string;
    readonly plugin?: string;
    constructor(capability: string, plugin?: string);
}
/** True if `capability` is in the granted set. */
declare function hasCapability(granted: readonly string[], capability: string): boolean;
/**
 * Assert a capability is granted, throwing {@link SonicCapabilityError} otherwise.
 */
declare function assertCapability(granted: readonly string[], capability: string, plugin?: string): void;
/**
 * Validate a plugin's declared capability list. Returns the unknown entries (empty
 * array = all valid). Callers decide whether to warn or hard-fail.
 */
declare function validateCapabilities(declared: readonly string[]): string[];
/** Provider factories for capability-backed accessors. Each is called lazily. */
interface CapabilityProviders {
    email?: () => unknown;
    cache?: () => unknown;
    http?: () => unknown;
}
/**
 * The gated context handed to a plugin. The accessors throw unless the backing
 * capability was declared; `has`/`require` allow explicit checks.
 */
interface PluginCapabilityContext {
    /** The capabilities granted to this plugin. */
    readonly capabilities: readonly string[];
    /** True if the plugin declared `capability`. */
    has(capability: string): boolean;
    /** Throw {@link SonicCapabilityError} unless `capability` was declared. */
    require(capability: string): void;
    /** Email service. Throws unless `email:send` was declared (and a provider exists). */
    readonly email: unknown;
    /** Cache service. Throws unless `cache:read` or `cache:write` was declared. */
    readonly cache: unknown;
    /** Outbound fetch. Throws unless `http:fetch` was declared. */
    readonly http: unknown;
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
declare function createCapabilityContext(granted: readonly string[], providers?: CapabilityProviders, plugin?: string): PluginCapabilityContext;

/**
 * Generic service-singleton factory
 *
 * Generalizes the hook-system-singleton pattern: a process-wide slot for a
 * service that code outside the HTTP request context — most importantly cron /
 * `scheduled()` handlers, which have no per-request `c.env` — can reach without
 * threading it through every call.
 *
 * Contract (same as the hook-system singleton):
 *  - `get()` throws if read before `set()` (throw-before-get) so wiring-order
 *    bugs surface loudly rather than silently no-oping.
 *  - `set()` is idempotent (last write wins) so constructing multiple apps in one
 *    process (e.g. across tests) never throws.
 *  - `reset()` clears the slot for test isolation.
 */
interface ServiceSingleton<T> {
    /** Set the process-wide instance. Last write wins. */
    set(instance: T): void;
    /** Get the instance; throws if not yet set. */
    get(): T;
    /** True if an instance has been set. */
    has(): boolean;
    /** Clear the slot (test isolation). */
    reset(): void;
}
/**
 * Create a service singleton.
 *
 * @param label Human-readable name used in the throw-before-get error message
 *              (e.g. `'EmailService'`).
 */
declare function createServiceSingleton<T>(label: string): ServiceSingleton<T>;

/**
 * Plugin cron surface
 *
 * A plugin declares scheduled work as data:
 *
 *   crons: [{ schedule: '*\/15 * * * *', hookFamily: 'email-reconciliation' }]
 *   async onCronTick(event, ctx) {
 *     if (event.hookFamily !== 'email-reconciliation') return
 *     ...
 *   }
 *
 * Declaring a schedule does NOT by itself run anything (same as Payload's jobs
 * queue): on Cloudflare Workers the execution mechanism is a Cron Trigger, which
 * the runtime delivers to the Worker's `scheduled()` handler. `createScheduledHandler`
 * builds that handler; it fans a fired trigger out to the plugins whose declared
 * schedule matches, tagging each call with the matching `hookFamily` so a plugin
 * with several crons can branch on it.
 *
 * The consumer must still register the cron expressions in `wrangler.toml`
 * (`[triggers] crons = [...]`); the schedules declared here are the source of
 * truth for which plugin handles which expression.
 *
 * Cron runs OUTSIDE the HTTP request context (no per-request `c.env`), which is
 * exactly why services are reached through env-independent singletons.
 */

/** A scheduled-work declaration on a plugin. */
interface CronDeclaration {
    /** Cron expression, e.g. `'*\/15 * * * *'`. Must also be in wrangler.toml triggers. */
    schedule: string;
    /** Logical family the handler branches on (e.g. `'email-reconciliation'`). */
    hookFamily: string;
}
/** The event passed to a plugin's `onCronTick`. */
interface CronTickEvent {
    /** The cron expression that fired. */
    cron: string;
    /** Epoch ms the trigger was scheduled for. */
    scheduledTime: number;
    /** The matching declaration's family, so a multi-cron plugin can branch. */
    hookFamily: string;
}
/** Context handed to `onCronTick`. Mirrors the boot context; carries no request env. */
interface CronContext {
    /** The live hook system (so cron work can dispatch/observe hooks). */
    hooks: HookSystemLike;
    /** Runtime bindings supplied by the Worker's scheduled() invocation. */
    env?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Structural contract this module needs from a plugin. Deliberately minimal (not
 * the full `Plugin`) so the `src`/`dist` duplicate identities and user plugins all
 * satisfy it without casts.
 */
interface CronablePlugin {
    name?: string;
    crons?: CronDeclaration[];
    onCronTick?: (event: CronTickEvent, context: CronContext) => void | Promise<void>;
}
/** A flattened view of every declared cron across a set of plugins. */
interface CollectedCron {
    plugin: string;
    schedule: string;
    hookFamily: string;
}
/** Flatten every plugin's `crons[]` into one list (for diagnostics / wrangler sync). */
declare function collectCrons(plugins: Array<CronablePlugin | undefined | null>): CollectedCron[];
/** The set of distinct cron expressions declared across plugins. */
declare function collectCronSchedules(plugins: Array<CronablePlugin | undefined | null>): string[];
/** Outcome of a cron dispatch. */
interface CronDispatchResult {
    /** Plugins whose `onCronTick` ran successfully (one entry per matching declaration). */
    invoked: Array<{
        plugin: string;
        hookFamily: string;
    }>;
    /** Per-plugin errors (dispatch never throws). */
    errors: Array<{
        plugin: string;
        hookFamily: string;
        error: unknown;
    }>;
    /** True if the fired cron matched no declared schedule. */
    unmatched: boolean;
}
/**
 * Dispatch one fired cron expression to the plugins that declared it.
 *
 * For each plugin whose `crons[]` contains a declaration with `schedule === cron`,
 * its `onCronTick` is invoked once per matching declaration, with the event's
 * `hookFamily` set to that declaration's family. Errors are isolated per plugin.
 */
declare function dispatchCronTick(plugins: Array<CronablePlugin | undefined | null>, cron: string, scheduledTime: number, context: CronContext): Promise<CronDispatchResult>;
/** Minimal shape of a Cloudflare `ScheduledController`. */
interface ScheduledControllerLike {
    cron: string;
    scheduledTime: number;
}
/** Minimal shape of a Cloudflare `ExecutionContext`. */
interface ExecutionContextLike {
    waitUntil?(promise: Promise<unknown>): void;
}
interface CreateScheduledHandlerOptions {
    /** Plugins to consider (evaluated lazily at fire time). */
    plugins: Array<CronablePlugin | undefined | null> | (() => Array<CronablePlugin | undefined | null>);
    /** Provides the hook system (e.g. the singleton getter). */
    getHooks: () => HookSystemLike;
    /** Optional: when true, skip dispatch entirely (mirrors plugins.disableAll). */
    disabled?: boolean;
}
/**
 * Build a Cloudflare `scheduled(controller, env, ctx)` handler that fans cron
 * triggers out to plugins.
 *
 * Usage in a Worker entry:
 *   export default {
 *     fetch: app.fetch,
 *     scheduled: createScheduledHandler({ plugins, getHooks: getHookSystem }),
 *   }
 */
declare function createScheduledHandler(options: CreateScheduledHandlerOptions): (controller: ScheduledControllerLike, env: Record<string, unknown>, ctx?: ExecutionContextLike) => Promise<CronDispatchResult>;

/**
 * definePlugin() — the v3 plugin authoring entry point
 *
 * A plugin is authored as a single typed declaration and consumed, unchanged, by
 * every part of the runtime:
 *
 *   export const emailPlugin = definePlugin({
 *     id: 'email',
 *     version: '3.0.0',
 *     capabilities: ['email:send', 'hooks.auth:subscribe', 'cron:register'],
 *     register(app) { app.route('/admin/plugins/email', emailRoutes) },   // SYNC
 *     async onBoot(ctx) {                                                  // ASYNC
 *       ctx.hooks.on('auth:registration:completed', (p) => { ... })       // typed
 *       ctx.cap.email                                                     // gated
 *     },
 *     crons: [{ schedule: '*\/15 * * * *', hookFamily: 'email-reconciliation' }],
 *     async onCronTick(event, ctx) { ... },
 *   })
 *
 * The object it returns satisfies the structural contracts the runtime already
 * uses — `MountablePlugin` (mount.ts), `WirablePlugin` (wire.ts), `CronablePlugin`
 * (cron.ts) — plus the legacy `Plugin` metadata fields the admin/registry read.
 * No adapters: a defined plugin drops straight into `plugins.register` or the core
 * plugin list.
 *
 * The value definePlugin adds over a hand-written object is the enriched context:
 * inside `onBoot`/`onCronTick` the author gets a *typed* hook facade (`ctx.hooks`)
 * and the *capability-gated* service context (`ctx.cap`), instead of the raw
 * string-keyed hook system. See the two-phase boot contract: `register` is
 * synchronous (routes only); everything env-dependent lives in `onBoot`.
 */

/**
 * Context handed to a defined plugin's `onBoot` / `onCronTick`.
 *
 * Enriches the raw boot/cron context with a typed hook facade and the gated
 * capability context, while keeping `raw` and `env` available as an escape hatch.
 */
interface DefinedPluginContext {
    /** Typed hook facade — `ctx.hooks.on('auth:registration:completed', …)`. */
    hooks: TypedHooks;
    /** Capability-gated services — `ctx.cap.email` throws without `email:send`. */
    cap: PluginCapabilityContext;
    /** Runtime bindings, when available (absent during construction). */
    env?: Record<string, unknown>;
    /** The unwrapped context the runtime passed. */
    raw: PluginBootContext | CronContext;
}
/** Input to {@link definePlugin}. */
interface DefinePluginInput {
    /** Unique, stable plugin id (kebab-case). Becomes the plugin `name`. */
    id: string;
    /** Human-readable display name. Defaults to `id`. */
    name?: string;
    /** Semantic version. */
    version: string;
    description?: string;
    author?: {
        name: string;
        email?: string;
        url?: string;
    };
    /** Other plugin ids this one needs (load-order / activation). */
    dependencies?: string[];
    /**
     * Capabilities this plugin declares. The gated `ctx.cap` accessors throw for
     * anything not listed here. Unknown capabilities are warned about at definition.
     */
    capabilities?: Capability[];
    /** Declarative routes (mounted before the /admin catch-all). */
    routes?: MountableRoute[];
    /**
     * Imperative route registration. MUST be synchronous (Hono's router locks after
     * the first request). Async work belongs in `onBoot`.
     */
    register?: (app: Hono) => void;
    /**
     * Run once on first request, after every plugin has registered. The place for
     * hook subscriptions and env-dependent setup.
     */
    onBoot?: (context: DefinedPluginContext) => void | Promise<void>;
    /** Scheduled-work declarations (also list the expressions in wrangler.toml). */
    crons?: CronDeclaration[];
    /** Handler for a fired cron; branch on `event.hookFamily`. */
    onCronTick?: (event: CronTickEvent, context: DefinedPluginContext) => void | Promise<void>;
    install?: (context: unknown) => void | Promise<void>;
    uninstall?: (context: unknown) => void | Promise<void>;
    activate?: (context: unknown) => void | Promise<void>;
    deactivate?: (context: unknown) => void | Promise<void>;
}
/**
 * The runtime shape produced by {@link definePlugin}. Carries the legacy metadata
 * fields plus the v3 surfaces; structurally satisfies `MountablePlugin`,
 * `WirablePlugin`, and `CronablePlugin`.
 */
interface DefinedPlugin {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: {
        name: string;
        email?: string;
        url?: string;
    };
    dependencies?: string[];
    capabilities: Capability[];
    routes?: MountableRoute[];
    register?: (app: Hono) => void;
    /** Wrapped onBoot accepting the runtime's raw boot context. */
    onBoot?: (context: PluginBootContext) => void | Promise<void>;
    crons?: CronDeclaration[];
    /** Wrapped onCronTick accepting the runtime's raw cron context. */
    onCronTick?: (event: CronTickEvent, context: CronContext) => void | Promise<void>;
    install?: (context: unknown) => void | Promise<void>;
    uninstall?: (context: unknown) => void | Promise<void>;
    activate?: (context: unknown) => void | Promise<void>;
    deactivate?: (context: unknown) => void | Promise<void>;
    /** Marker so tooling/tests can detect a v3-defined plugin. */
    readonly __sonicV3: true;
}
/**
 * Define a v3 plugin. Validates declared capabilities (warns on unknown), then
 * returns a runtime-ready plugin whose `onBoot`/`onCronTick` receive the enriched,
 * typed, capability-gated context.
 */
declare function definePlugin(input: DefinePluginInput): DefinedPlugin;
/** True if `plugin` was produced by {@link definePlugin}. */
declare function isDefinedPlugin(plugin: unknown): plugin is DefinedPlugin;

interface TurnstileSettings {
    siteKey: string;
    secretKey: string;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
    mode?: 'managed' | 'non-interactive' | 'invisible';
    appearance?: 'always' | 'execute' | 'interaction-only';
    preClearance?: boolean;
    preClearanceLevel?: 'interactive' | 'managed' | 'non-interactive';
    enabled: boolean;
}
declare class TurnstileService {
    private db;
    private readonly VERIFY_URL;
    constructor(db: D1Database);
    /**
     * Get Turnstile settings from database
     */
    getSettings(): Promise<TurnstileSettings | null>;
    /**
     * Verify a Turnstile token with Cloudflare
     */
    verifyToken(token: string, remoteIp?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Save Turnstile settings to database
     */
    saveSettings(settings: TurnstileSettings): Promise<void>;
    /**
     * Check if Turnstile is enabled
     */
    isEnabled(): Promise<boolean>;
}

/**
 * Middleware to verify Turnstile token on form submissions
 *
 * Usage:
 * ```typescript
 * import { verifyTurnstile } from '@sonicjs-cms/core/plugins'
 *
 * app.post('/api/contact', verifyTurnstile, async (c) => {
 *   // Token already verified, process form...
 * })
 * ```
 */
declare function verifyTurnstile(c: Context, next: Next): Promise<void | (Response & hono.TypedResponse<{
    error: string;
}, 500, "json">) | (Response & hono.TypedResponse<{
    error: string;
    message: string;
}, 400, "json">) | (Response & hono.TypedResponse<{
    error: string;
    message: string;
}, 403, "json">)>;
/**
 * Middleware factory that allows custom error handling
 */
declare function createTurnstileMiddleware(options?: {
    onError?: (c: Context, error: string) => Response;
    onMissing?: (c: Context) => Response;
}): (c: Context, next: Next) => Promise<void | Response>;

export { type AuthPasswordResetCompletedPayload, type AuthPasswordResetRequestedPayload, type AuthRegistrationCompletedPayload, type Capability, type CapabilityProviders, type CollectedCron, type ContentEventPayload, type CreateScheduledHandlerOptions, type CronContext, type CronDeclaration, type CronDispatchResult, type CronTickEvent, type CronablePlugin, type DbCapability, type DefinePluginInput, type DefinedPlugin, type DefinedPluginContext, type ExecutionContextLike, FIXED_CAPABILITIES, type FixedCapability, HOOK_EVENT_NAMES, type HookEventName, type HookEventPayloads, type HookPayload, type HookSystemLike, type MountResult, type MountedRoute, type PluginBootContext, type PluginCapabilityContext, PluginRegisterMustBeSyncError, type RegisterPluginRoutesOptions, type ScheduledControllerLike, type ServiceSingleton, SonicCapabilityError, TurnstileService, type TypedHookContext, type TypedHookHandler, type TypedHooks, type WirableHook, type WirablePlugin, type WireResult, assertCapability, collectCronSchedules, collectCrons, createCapabilityContext, createPluginWirer, createScheduledHandler, createServiceSingleton, createTurnstileMiddleware, createTypedHooks, definePlugin, dispatchCronTick, getHookSystem, getTypedHooks, hasCapability, hasHookSystem, isDefinedPlugin, isKnownCapability, isKnownHookEvent, mountPlugin, registerPluginRoutes, resetHookSystem, setHookSystem, validateCapabilities, verifyTurnstile, wireRegisteredPlugins };
