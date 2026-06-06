/**
 * My SonicJS Application
 *
 * Exports both `fetch` (HTTP) and `scheduled` (cron) so the Worker handles both
 * cold-start paths. app.boot() ensures a cron-first cold isolate still gets the
 * hook bus wired before dispatching.
 */

import {
  createSonicJSApp,
  registerCollections,
  createScheduledHandler,
  getHookSystem,
  emailReconciliationPlugin,
  collectCronSchedules,
} from '@sonicjs-cms/core'
import type { SonicJSConfig } from '@sonicjs-cms/core'

// Import custom collections
import blogPostsCollection from './collections/blog-posts.collection'
import pageBlocksCollection from './collections/page-blocks.collection'
import contactMessagesCollection from './collections/contact-messages.collection'

// Import plugins
import contactFormPlugin from './plugins/contact-form/index'

// Register all custom collections
registerCollections([
  blogPostsCollection,
  pageBlocksCollection,
  contactMessagesCollection
])

// Application configuration
const config: SonicJSConfig = {
  collections: {
    autoSync: true
  },
  plugins: {
    register: [contactFormPlugin],
    disableAll: false,
  }
}

// Create the core application (includes boot() for cron cold-start wiring)
const app = createSonicJSApp(config)

// All plugins that declare crons, for the scheduled handler.
// Core crons (emailReconciliationPlugin) are wired automatically by createSonicJSApp.
// Add any custom plugins with crons to this list.
const allCronPlugins = [emailReconciliationPlugin, ...( config.plugins?.register ?? [])]

// Log declared schedules at startup so wrangler.toml can be kept in sync.
const schedules = collectCronSchedules(allCronPlugins)
if (schedules.length > 0) {
  console.log('[cron] Declared schedules:', schedules.join(', '))
}

export default {
  fetch: app.fetch,
  scheduled: createScheduledHandler({
    plugins: allCronPlugins,
    getHooks: getHookSystem,
    boot: app.boot,
  }),
}
