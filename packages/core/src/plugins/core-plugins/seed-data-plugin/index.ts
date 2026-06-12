/**
 * Seed Data Plugin — Payload-shaped port.
 */

import { definePlugin } from '../../sdk/define-plugin'
import { SeedDataService } from './services/seed-data-service'

export const seedDataPlugin = definePlugin({
  id: 'seed-data',
  version: '1.0.0',
  name: 'Seed Data',
  description: 'Generate realistic example users and content for testing and development.',
  sonicjsVersionRange: '^3.0.0',
  author: { name: 'SonicJS', email: 'admin@sonicjs.com' },

  menu: [
    { label: 'Seed Data', path: '/admin/seed-data', icon: 'document', order: 65, permissions: ['admin'] },
  ],
})

export function createSeedDataPlugin() {
  return seedDataPlugin
}

export { SeedDataService }
