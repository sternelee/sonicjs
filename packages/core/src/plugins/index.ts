/**
 * Plugins Module Exports
 *
 * Plugin system and SDK for SonicJS
 */

// Hook System
export { HookSystemImpl, ScopedHookSystem, HookUtils } from './hook-system'

// Plugin Registry
export { PluginRegistryImpl } from './plugin-registry'

// Plugin Manager
export { PluginManager } from './plugin-manager'

// Plugin Validator
export { PluginValidator } from './plugin-validator'

// Route mounting primitive
export {
  registerPluginRoutes,
  mountPlugin,
  PluginRegisterMustBeSyncError,
} from './mount'
export type { MountResult, MountedRoute, RegisterPluginRoutesOptions } from './mount'

// Core Plugins
export { 
  verifyTurnstile, 
  createTurnstileMiddleware, 
  TurnstileService 
} from './core-plugins/turnstile-plugin'
