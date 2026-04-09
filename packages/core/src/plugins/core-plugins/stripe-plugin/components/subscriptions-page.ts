import type { Subscription, SubscriptionStats, SubscriptionStatus } from '../types'

export function renderSubscriptionsPage(
  subscriptions: (Subscription & { userEmail?: string })[],
  stats: SubscriptionStats,
  filters: { status?: string; page: number; totalPages: number }
): string {
  return `
    <div class="space-y-6">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        ${statsCard('Total', stats.total, 'text-gray-700')}
        ${statsCard('Active', stats.active, 'text-green-600')}
        ${statsCard('Trialing', stats.trialing, 'text-blue-600')}
        ${statsCard('Past Due', stats.pastDue, 'text-yellow-600')}
        ${statsCard('Canceled', stats.canceled, 'text-red-600')}
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4">
        <form method="GET" class="flex items-center gap-4">
          <label class="text-sm font-medium text-gray-700">Status:</label>
          <select name="status" class="border rounded px-3 py-1.5 text-sm" onchange="this.form.submit()">
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
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Period</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cancel at End</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stripe</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${subscriptions.length === 0
              ? '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No subscriptions found</td></tr>'
              : subscriptions.map(renderRow).join('')
            }
          </tbody>
        </table>

        ${renderPagination(filters.page, filters.totalPages, filters.status)}
      </div>
    </div>
  `
}

function statsCard(label: string, value: number, colorClass: string): string {
  return `
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-sm font-medium text-gray-500">${label}</div>
      <div class="text-2xl font-bold ${colorClass}">${value}</div>
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
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-red-100 text-red-800',
    unpaid: 'bg-orange-100 text-orange-800',
    paused: 'bg-gray-100 text-gray-800',
    incomplete: 'bg-gray-100 text-gray-500',
    incomplete_expired: 'bg-red-100 text-red-500'
  }
  const color = colors[status] || 'bg-gray-100 text-gray-800'
  const label = status.replace('_', ' ')
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}">${label}</span>`
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
    <tr>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${sub.userEmail || sub.userId}</div>
        <div class="text-xs text-gray-500">${sub.stripeCustomerId}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">${statusBadge(sub.status)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sub.stripePriceId}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(sub.currentPeriodStart)} - ${formatDate(sub.currentPeriodEnd)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        ${sub.cancelAtPeriodEnd
          ? '<span class="text-yellow-600 font-medium">Yes</span>'
          : '<span class="text-gray-400">No</span>'
        }
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <a href="https://dashboard.stripe.com/subscriptions/${sub.stripeSubscriptionId}"
           target="_blank" rel="noopener noreferrer"
           class="text-indigo-600 hover:text-indigo-800">
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
    <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
      <div class="text-sm text-gray-700">
        Page ${page} of ${totalPages}
      </div>
      <div class="flex gap-2">
        ${page > 1
          ? `<a href="?page=${page - 1}${params}" class="px-3 py-1 border rounded text-sm hover:bg-gray-50">Previous</a>`
          : ''
        }
        ${page < totalPages
          ? `<a href="?page=${page + 1}${params}" class="px-3 py-1 border rounded text-sm hover:bg-gray-50">Next</a>`
          : ''
        }
      </div>
    </div>
  `
}
