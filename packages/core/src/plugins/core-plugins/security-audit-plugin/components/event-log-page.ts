import { renderAdminLayoutCatalyst, AdminLayoutCatalystData } from '../../../../templates/layouts/admin-layout-catalyst.template'
import type { SecurityEvent, SecurityEventFilters } from '../types'

interface BaseUser {
  name: string
  email: string
  role: string
}

export interface EventLogPageData {
  events: SecurityEvent[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    startItem: number
    endItem: number
  }
  filters: SecurityEventFilters
  user?: BaseUser
  version?: string
  dynamicMenuItems?: Array<{ label: string; path: string; icon: string }>
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  return `<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colors[severity] || colors.info}">${severity}</span>`
}

function eventTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    login_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    login_failure: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    account_lockout: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    suspicious_activity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    logout: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
    password_reset_request: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    permission_denied: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  }
  const labels: Record<string, string> = {
    login_success: 'Login OK',
    login_failure: 'Login Failed',
    registration: 'Registration',
    account_lockout: 'Lockout',
    suspicious_activity: 'Suspicious',
    logout: 'Logout',
    password_reset_request: 'Password Reset',
    permission_denied: 'Access Denied'
  }
  const color = colors[type] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
  return `<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${color}">${labels[type] || type}</span>`
}

function buildFilterUrl(filters: SecurityEventFilters, overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  if (filters.eventType && !overrides.type) params.set('type', String(filters.eventType))
  if (filters.severity && !overrides.severity) params.set('severity', String(filters.severity))
  if (filters.email && !overrides.email) params.set('email', filters.email)
  if (filters.ipAddress && !overrides.ip) params.set('ip', filters.ipAddress)
  if (filters.search && !overrides.search) params.set('search', filters.search)

  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value)
  }

  const qs = params.toString()
  return `/admin/plugins/security-audit/events${qs ? '?' + qs : ''}`
}

export function renderEventLogPage(data: EventLogPageData): string {
  const { events, pagination, filters, user, version, dynamicMenuItems } = data

  const content = `
    <div>
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <div class="sm:flex-auto">
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Security Event Log</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Browse and filter all security events. Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems}.
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 flex gap-x-2">
          <a href="/admin/plugins/security-audit"
            class="inline-flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-semibold text-zinc-950 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10 transition-colors shadow-sm">
            Dashboard
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm mb-6">
        <form method="GET" action="/admin/plugins/security-audit/events" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Event Type</label>
            <select name="type" class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
              <option value="">All Types</option>
              <option value="login_success" ${filters.eventType === 'login_success' ? 'selected' : ''}>Login Success</option>
              <option value="login_failure" ${filters.eventType === 'login_failure' ? 'selected' : ''}>Login Failure</option>
              <option value="registration" ${filters.eventType === 'registration' ? 'selected' : ''}>Registration</option>
              <option value="account_lockout" ${filters.eventType === 'account_lockout' ? 'selected' : ''}>Account Lockout</option>
              <option value="suspicious_activity" ${filters.eventType === 'suspicious_activity' ? 'selected' : ''}>Suspicious Activity</option>
              <option value="logout" ${filters.eventType === 'logout' ? 'selected' : ''}>Logout</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Severity</label>
            <select name="severity" class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
              <option value="">All Severities</option>
              <option value="info" ${filters.severity === 'info' ? 'selected' : ''}>Info</option>
              <option value="warning" ${filters.severity === 'warning' ? 'selected' : ''}>Warning</option>
              <option value="critical" ${filters.severity === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Email</label>
            <input type="text" name="email" value="${filters.email || ''}" placeholder="Filter by email"
              class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500 placeholder:text-zinc-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">IP Address</label>
            <input type="text" name="ip" value="${filters.ipAddress || ''}" placeholder="Filter by IP"
              class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500 placeholder:text-zinc-400">
          </div>
          <div class="flex items-end gap-2">
            <button type="submit"
              class="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors shadow-sm">
              Filter
            </button>
            <a href="/admin/plugins/security-audit/events"
              class="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Clear
            </a>
          </div>
        </form>
      </div>

      <!-- Events Table -->
      <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm overflow-hidden">
        ${events.length === 0
          ? `<div class="p-12 text-center">
              <svg class="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <h3 class="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">No events found</h3>
              <p class="mt-1 text-sm text-zinc-500">No security events match your current filters.</p>
            </div>`
          : `<div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead>
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Severity</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">IP Address</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Country</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
                ${events.map(event => `
                  <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" onclick="this.querySelector('.event-details').classList.toggle('hidden')">
                    <td class="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 whitespace-nowrap">${formatTimestamp(event.createdAt)}</td>
                    <td class="px-4 py-3">${eventTypeBadge(event.eventType)}</td>
                    <td class="px-4 py-3">${severityBadge(event.severity)}</td>
                    <td class="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 max-w-[200px] truncate">${event.email || '-'}</td>
                    <td class="px-4 py-3 text-sm font-mono text-zinc-600 dark:text-zinc-300">${event.ipAddress || '-'}</td>
                    <td class="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">${event.countryCode || '-'}</td>
                    <td class="px-4 py-3">
                      ${event.blocked
                        ? '<span class="inline-flex items-center rounded-md bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">Blocked</span>'
                        : '<span class="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Allowed</span>'
                      }
                    </td>
                  </tr>
                  <tr class="event-details hidden">
                    <td colspan="7" class="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30">
                      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div><span class="font-medium text-zinc-500">Event ID:</span> <span class="text-zinc-700 dark:text-zinc-300 font-mono">${event.id.substring(0, 8)}...</span></div>
                        <div><span class="font-medium text-zinc-500">User Agent:</span> <span class="text-zinc-700 dark:text-zinc-300 truncate block max-w-[300px]">${event.userAgent || '-'}</span></div>
                        <div><span class="font-medium text-zinc-500">Path:</span> <span class="text-zinc-700 dark:text-zinc-300">${event.requestPath || '-'}</span></div>
                        <div><span class="font-medium text-zinc-500">Fingerprint:</span> <span class="text-zinc-700 dark:text-zinc-300 font-mono">${event.fingerprint || '-'}</span></div>
                        ${event.details ? `<div class="col-span-full"><span class="font-medium text-zinc-500">Details:</span> <pre class="text-zinc-700 dark:text-zinc-300 mt-1 bg-zinc-100 dark:bg-zinc-900 rounded p-2 overflow-x-auto">${JSON.stringify(event.details, null, 2)}</pre></div>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        }

        <!-- Pagination -->
        ${pagination.totalPages > 1 ? `
          <div class="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <div class="text-sm text-zinc-500">
              Page ${pagination.currentPage} of ${pagination.totalPages}
            </div>
            <div class="flex gap-1">
              ${pagination.currentPage > 1 ? `
                <a href="${buildFilterUrl(filters, { page: String(pagination.currentPage - 1) })}"
                  class="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Previous
                </a>
              ` : ''}
              ${pagination.currentPage < pagination.totalPages ? `
                <a href="${buildFilterUrl(filters, { page: String(pagination.currentPage + 1) })}"
                  class="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Next
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `

  const layoutData: AdminLayoutCatalystData = {
    title: 'Security Event Log',
    pageTitle: 'Security Event Log',
    currentPath: '/admin/plugins/security-audit/events',
    user,
    content,
    version,
    dynamicMenuItems
  }

  return renderAdminLayoutCatalyst(layoutData)
}
