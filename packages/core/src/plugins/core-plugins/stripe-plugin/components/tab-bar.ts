/**
 * Shared tab bar for all Stripe admin pages.
 */

const TABS = [
  { label: 'Subscriptions', path: '/admin/plugins/stripe' },
  { label: 'Events', path: '/admin/plugins/stripe/events' },
  { label: 'Settings', path: '/admin/plugins/stripe/settings' },
]

export function renderStripeTabBar(currentPath: string): string {
  const tabs = TABS.map(tab => {
    const isActive = currentPath === tab.path
      || (tab.path === '/admin/plugins/stripe' && currentPath === '/admin/plugins/stripe/')
    return `
      <a href="${tab.path}"
        class="${isActive
          ? 'border-cyan-500 text-zinc-950 dark:text-white'
          : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
        } whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors">
        ${tab.label}
      </a>`
  }).join('')

  return `
    <div class="border-b border-zinc-950/5 dark:border-white/10 mb-6">
      <nav class="-mb-px flex gap-x-2" aria-label="Stripe tabs">
        ${tabs}
      </nav>
    </div>
  `
}
