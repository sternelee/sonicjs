/**
 * My SonicJS Application — v3 greenfield
 *
 * Schema is now documents + auth only. All non-critical plugins are disabled
 * until the code is re-wired to the document model. Auth (password/magic-link/otp)
 * still works; plugin bootstrap is skipped (no plugins table).
 */

import { createSonicJSApp, registerCollections } from '@sonicjs-cms/core'
import type { SonicJSConfig } from '@sonicjs-cms/core'

// Import code-defined collections
import blogPostsCollection from './collections/blog-posts.collection'
import contactMessagesCollection from './collections/contact-messages.collection'
import pageBlocksCollection from './collections/page-blocks.collection'

// Register collections so they appear in admin UI
registerCollections([
  blogPostsCollection,
  contactMessagesCollection,
  pageBlocksCollection
])

const config: SonicJSConfig = {
  plugins: {
    disableAll: true,  // v3: plugins table dropped; re-enable per plugin as code is rewired
  }
}

const app = createSonicJSApp(config)

export default app
