import type { Subscription, SubscriptionStats, SubscriptionStatus } from '../types'
import { renderAdminLayoutCatalyst, type AdminLayoutCatalystData } from '../../../../templates/layouts/admin-layout-catalyst.template'
import { renderStripeTabBar } from './tab-bar'

export interface StripePageData {
  subscriptions: (Subscription & { userEmail?: string })[]
  stats: SubscriptionStats
  filters: { status?: string; page: number; totalPages: number }
  user?: { name: string; email: string; role: string }
  version?: string
  dynamicMenuItems?: Array<{ label: string; path: string; icon: string }>
}

export function renderSubscriptionsPage(data: StripePageData): string {
  const { subscriptions, stats, filters, user, version, dynamicMenuItems } = data

  const content = `
    <div>
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <div class="sm:flex-auto">
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Stripe</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Manage subscriptions, view billing status, and monitor payment events.
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16">
          <button id="sync-btn" onclick="syncSubscriptions()"
            class="inline-flex items-center justify-center rounded-lg bg-zinc-950 dark:bg-white px-3.5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
            Sync from Stripe
          </button>
        </div>
      </div>

      ${renderStripeTabBar('/admin/plugins/stripe')}

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        ${statsCard('Total', stats.total, 'text-zinc-950 dark:text-white')}
        ${statsCard('Active', stats.active, 'text-emerald-600 dark:text-emerald-400')}
        ${statsCard('Trialing', stats.trialing, 'text-blue-600 dark:text-blue-400')}
        ${statsCard('Past Due', stats.pastDue, 'text-amber-600 dark:text-amber-400')}
        ${statsCard('Canceled', stats.canceled, 'text-red-600 dark:text-red-400')}
      </div>

      <!-- Filters -->
      <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-4 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm mb-6">
        <form method="GET" class="flex items-center gap-4">
          <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status:</label>
          <select name="status" class="rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-950 dark:text-white ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10" onchange="this.form.submit()">
            <option value="">All</option>
            ${statusOption('active', filters.status)}
            ${statusOption('trialing', filters.status)}
            ${statusOption('past_due', filters.status)}
            ${statusOption('canceled', filters.status)}
            ${statusOption('unpaid', filters.status)}
            ${statusOption('paused', filters.status)}
          </select>
        </form>
      </div>

      <!-- Subscriptions Table -->
      <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-zinc-950/5 dark:divide-white/5">
          <thead>
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Price ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Current Period</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cancel at End</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stripe</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-950/5 dark:divide-white/5">
            ${subscriptions.length === 0
              ? '<tr><td colspan="6" class="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">No subscriptions found</td></tr>'
              : subscriptions.map(renderRow).join('')
            }
          </tbody>
        </table>

        ${renderPagination(filters.page, filters.totalPages, filters.status)}
      </div>

      <div id="sync-message" class="hidden mt-4 rounded-lg p-4 text-sm"></div>
    </div>

    <script>
      async function syncSubscriptions() {
        const btn = document.getElementById('sync-btn')
        const msg = document.getElementById('sync-message')
        btn.disabled = true
        btn.textContent = 'Syncing...'
        msg.className = 'hidden mt-4 rounded-lg p-4 text-sm'
        try {
          const res = await fetch('/api/stripe/sync-subscriptions', { method: 'POST' })
          const result = await res.json()
          if (result.success) {
            msg.className = 'mt-4 rounded-lg p-4 text-sm bg-emerald-400/10 text-emerald-500 dark:text-emerald-400 ring-1 ring-inset ring-emerald-400/20'
            msg.textContent = 'Synced ' + result.synced + ' of ' + result.total + ' subscriptions from Stripe.' + (result.errors > 0 ? ' (' + result.errors + ' errors)' : '')
            setTimeout(() => location.reload(), 1500)
          } else {
            msg.className = 'mt-4 rounded-lg p-4 text-sm bg-red-400/10 text-red-500 dark:text-red-400 ring-1 ring-inset ring-red-400/20'
            msg.textContent = result.error || 'Sync failed.'
          }
        } catch {
          msg.className = 'mt-4 rounded-lg p-4 text-sm bg-red-400/10 text-red-500 dark:text-red-400 ring-1 ring-inset ring-red-400/20'
          msg.textContent = 'Network error. Please try again.'
        }
        btn.disabled = false
        btn.textContent = 'Sync from Stripe'
      }
    </script>
  `

  const layoutData: AdminLayoutCatalystData = {
    title: 'Stripe Subscriptions',
    pageTitle: 'Stripe Subscriptions',
    currentPath: '/admin/plugins/stripe',
    user,
    content,
    version,
    dynamicMenuItems
  }

  return renderAdminLayoutCatalyst(layoutData)
}

function statsCard(label: string, value: number, colorClass: string): string {
  return `
    <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
      <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">${label}</p>
      <p class="mt-2 text-3xl font-bold ${colorClass}">${value}</p>
    </div>
  `
}

function statusOption(value: string, current?: string): string {
  const selected = value === current ? 'selected' : ''
  const label = value.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
  return `<option value="${value}" ${selected}>${label}</option>`
}

function statusBadge(status: SubscriptionStatus): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-400/10 text-emerald-500 dark:text-emerald-400 ring-emerald-400/20',
    trialing: 'bg-blue-400/10 text-blue-500 dark:text-blue-400 ring-blue-400/20',
    past_due: 'bg-amber-400/10 text-amber-500 dark:text-amber-400 ring-amber-400/20',
    canceled: 'bg-red-400/10 text-red-500 dark:text-red-400 ring-red-400/20',
    unpaid: 'bg-orange-400/10 text-orange-500 dark:text-orange-400 ring-orange-400/20',
    paused: 'bg-zinc-400/10 text-zinc-500 dark:text-zinc-400 ring-zinc-400/20',
    incomplete: 'bg-zinc-400/10 text-zinc-500 dark:text-zinc-400 ring-zinc-400/20',
    incomplete_expired: 'bg-red-400/10 text-red-500 dark:text-red-400 ring-red-400/20'
  }
  const color = colors[status] || 'bg-zinc-400/10 text-zinc-500 ring-zinc-400/20'
  const label = status.replace('_', ' ')
  return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${color}">${label}</span>`
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function renderRow(sub: Subscription & { userEmail?: string }): string {
  return `
    <tr class="hover:bg-zinc-950/[0.025] dark:hover:bg-white/[0.025]">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-zinc-950 dark:text-white">${sub.userEmail || sub.userId}</div>
        <div class="text-xs text-zinc-500 dark:text-zinc-400">${sub.stripeCustomerId}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">${statusBadge(sub.status)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">${sub.stripePriceId}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
        ${formatDate(sub.currentPeriodStart)} - ${formatDate(sub.currentPeriodEnd)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        ${sub.cancelAtPeriodEnd
          ? '<span class="text-amber-500 dark:text-amber-400 font-medium">Yes</span>'
          : '<span class="text-zinc-400 dark:text-zinc-500">No</span>'
        }
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <a href="https://dashboard.stripe.com/subscriptions/${sub.stripeSubscriptionId}"
           target="_blank" rel="noopener noreferrer"
           class="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300">
          View in Stripe
        </a>
      </td>
    </tr>
  `
}

function renderPagination(page: number, totalPages: number, status?: string): string {
  if (totalPages <= 1) return ''

  const params = status ? `&status=${status}` : ''
  return `
    <div class="px-6 py-3 flex items-center justify-between border-t border-zinc-950/5 dark:border-white/5">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">
        Page ${page} of ${totalPages}
      </div>
      <div class="flex gap-2">
        ${page > 1
          ? `<a href="?page=${page - 1}${params}" class="px-3 py-1 rounded-lg text-sm text-zinc-950 dark:text-white ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800">Previous</a>`
          : ''
        }
        ${page < totalPages
          ? `<a href="?page=${page + 1}${params}" class="px-3 py-1 rounded-lg text-sm text-zinc-950 dark:text-white ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800">Next</a>`
          : ''
        }
      </div>
    </div>
  `
}
