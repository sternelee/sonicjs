import { renderAdminLayoutCatalyst, AdminLayoutCatalystData } from '../../../../templates/layouts/admin-layout-catalyst.template'
import type { SecurityStats, TopIP, HourlyBucket, SecurityEvent } from '../types'

interface BaseUser {
  name: string
  email: string
  role: string
}

export interface SecurityDashboardData {
  stats: SecurityStats
  topIPs: TopIP[]
  hourlyTrend: HourlyBucket[]
  recentCritical: SecurityEvent[]
  user?: BaseUser
  version?: string
  dynamicMenuItems?: Array<{ label: string; path: string; icon: string }>
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const now = Date.now()
  const diff = now - ts

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  return labels[type] || type
}

function trendArrow(trend: number): string {
  if (trend > 0) return `<span class="text-red-500">+${trend}%</span>`
  if (trend < 0) return `<span class="text-emerald-500">${trend}%</span>`
  return `<span class="text-zinc-400">0%</span>`
}

function renderBarChart(data: HourlyBucket[]): string {
  if (data.length === 0) return '<p class="text-zinc-500 text-sm">No data available</p>'

  const max = Math.max(...data.map(d => d.count), 1)

  const bars = data.map(d => {
    const height = Math.max((d.count / max) * 100, 2)
    const color = d.count === 0
      ? 'bg-zinc-200 dark:bg-zinc-700'
      : d.count >= max * 0.75
        ? 'bg-red-500'
        : d.count >= max * 0.5
          ? 'bg-amber-500'
          : 'bg-cyan-500'
    return `
      <div class="flex flex-col items-center flex-1 min-w-0 group relative">
        <div class="w-full flex flex-col items-center justify-end" style="height: 120px">
          <div class="absolute bottom-8 hidden group-hover:block bg-zinc-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
            ${d.hour}: ${d.count} failed
          </div>
          <div class="${color} w-full max-w-[12px] rounded-t transition-all" style="height: ${height}%"></div>
        </div>
        <span class="text-[9px] text-zinc-400 mt-1 ${data.length > 12 ? 'hidden sm:block' : ''}">${d.hour}</span>
      </div>
    `
  }).join('')

  return `<div class="flex items-end gap-px">${bars}</div>`
}

export function renderSecurityDashboard(data: SecurityDashboardData): string {
  const { stats, topIPs, hourlyTrend, recentCritical, user, version, dynamicMenuItems } = data

  const content = `
    <div>
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <div class="sm:flex-auto">
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Security Dashboard</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Monitor login attempts, brute-force detection, and security events.
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 flex gap-x-2">
          <a href="/admin/plugins/security-audit/events"
            class="inline-flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-semibold text-zinc-950 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10 transition-colors shadow-sm">
            View Event Log
          </a>
          <a href="/api/security-audit/export?format=csv"
            class="inline-flex items-center justify-center rounded-lg bg-zinc-950 dark:bg-white px-3.5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
            Export CSV
          </a>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Events</p>
          <p class="mt-2 text-3xl font-bold text-zinc-950 dark:text-white">${stats.totalEvents.toLocaleString()}</p>
        </div>
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Failed Logins (24h)</p>
          <p class="mt-2 text-3xl font-bold text-zinc-950 dark:text-white">
            ${stats.failedLogins24h}
            <span class="ml-2 text-sm font-normal">${trendArrow(stats.failedLoginsTrend)}</span>
          </p>
        </div>
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Lockouts</p>
          <p class="mt-2 text-3xl font-bold ${stats.activeLockouts > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-950 dark:text-white'}">${stats.activeLockouts}</p>
        </div>
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Flagged IPs</p>
          <p class="mt-2 text-3xl font-bold ${stats.flaggedIPs > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-950 dark:text-white'}">${stats.flaggedIPs}</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Failed Login Trend -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white mb-4">Failed Login Attempts (24h)</h2>
          ${renderBarChart(hourlyTrend)}
        </div>

        <!-- Events by Type -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white mb-4">Events by Type (24h)</h2>
          <div class="space-y-3">
            ${Object.entries(stats.eventsByType).length === 0
              ? '<p class="text-zinc-500 text-sm">No events in the last 24 hours</p>'
              : Object.entries(stats.eventsByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const total = Object.values(stats.eventsByType).reduce((s, v) => s + v, 0)
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return `
                    <div>
                      <div class="flex justify-between text-sm mb-1">
                        <span class="text-zinc-600 dark:text-zinc-300">${eventTypeBadge(type)}</span>
                        <span class="text-zinc-500 dark:text-zinc-400">${count}</span>
                      </div>
                      <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                        <div class="h-1.5 rounded-full ${type === 'login_failure' ? 'bg-red-500' : type === 'login_success' ? 'bg-emerald-500' : 'bg-cyan-500'}" style="width: ${pct}%"></div>
                      </div>
                    </div>
                  `
                }).join('')
            }
          </div>
        </div>
      </div>

      <!-- Top IPs and Recent Critical -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top IPs -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-zinc-100 dark:border-zinc-800">
            <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Top IPs by Failed Logins (24h)</h2>
          </div>
          ${topIPs.length === 0
            ? '<div class="p-5"><p class="text-zinc-500 text-sm">No failed login attempts</p></div>'
            : `<table class="min-w-full">
              <thead>
                <tr class="border-b border-zinc-100 dark:border-zinc-800">
                  <th class="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase">IP Address</th>
                  <th class="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Country</th>
                  <th class="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Attempts</th>
                  <th class="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                ${topIPs.map(ip => `
                  <tr class="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td class="px-5 py-3 text-sm font-mono text-zinc-900 dark:text-zinc-100">${ip.ipAddress}</td>
                    <td class="px-5 py-3 text-sm text-zinc-600 dark:text-zinc-400">${ip.countryCode || '-'}</td>
                    <td class="px-5 py-3 text-sm text-right font-semibold ${ip.failedAttempts >= 10 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}">${ip.failedAttempts}</td>
                    <td class="px-5 py-3 text-sm text-right">
                      ${ip.locked
                        ? '<span class="inline-flex items-center rounded-md bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">Locked</span>'
                        : '<span class="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Active</span>'
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          }
        </div>

        <!-- Recent Critical Events -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-zinc-100 dark:border-zinc-800">
            <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Recent Critical Events</h2>
          </div>
          ${recentCritical.length === 0
            ? '<div class="p-5"><p class="text-zinc-500 text-sm">No critical events</p></div>'
            : `<div class="divide-y divide-zinc-100 dark:divide-zinc-800">
              ${recentCritical.slice(0, 10).map(event => `
                <div class="px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      ${severityBadge(event.severity)}
                      <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${eventTypeBadge(event.eventType)}</span>
                    </div>
                    <span class="text-xs text-zinc-400">${formatTimestamp(event.createdAt)}</span>
                  </div>
                  <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    ${event.ipAddress ? `IP: ${event.ipAddress}` : ''}
                    ${event.email ? ` | ${event.email}` : ''}
                  </div>
                </div>
              `).join('')}
            </div>`
          }
        </div>
      </div>
    </div>
  `

  const layoutData: AdminLayoutCatalystData = {
    title: 'Security Dashboard',
    pageTitle: 'Security Dashboard',
    currentPath: '/admin/plugins/security-audit',
    user,
    content,
    version,
    dynamicMenuItems
  }

  return renderAdminLayoutCatalyst(layoutData)
}
