import { renderAdminLayoutCatalyst, AdminLayoutCatalystData } from '../../../../templates/layouts/admin-layout-catalyst.template'
import type { SecurityAuditSettings } from '../types'

interface BaseUser {
  name: string
  email: string
  role: string
}

export interface SecuritySettingsPageData {
  settings: SecurityAuditSettings
  user?: BaseUser
  version?: string
  message?: string
  dynamicMenuItems?: Array<{ label: string; path: string; icon: string }>
}

export function renderSecuritySettingsPage(data: SecuritySettingsPageData): string {
  const { settings, user, version, message, dynamicMenuItems } = data

  const content = `
    <div>
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <div class="sm:flex-auto">
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Security Audit Settings</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Configure brute-force detection thresholds, event logging, and data retention.
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 flex gap-x-2">
          <a href="/admin/plugins/security-audit"
            class="inline-flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-semibold text-zinc-950 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10 transition-colors shadow-sm">
            Dashboard
          </a>
        </div>
      </div>

      ${message ? `
        <div class="mb-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4 ring-1 ring-emerald-200 dark:ring-emerald-800">
          <p class="text-sm text-emerald-800 dark:text-emerald-300">${message}</p>
        </div>
      ` : ''}

      <form method="POST" action="/admin/plugins/security-audit/settings"
        class="space-y-6"
        hx-post="/admin/plugins/security-audit/settings"
        hx-swap="none"
        hx-on::after-request="if(event.detail.successful) { window.showNotification && window.showNotification('Settings saved', 'success'); } else { window.showNotification && window.showNotification('Failed to save', 'error'); }">

        <!-- Brute Force Detection -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <h2 class="text-base font-semibold text-zinc-950 dark:text-white mb-4">Brute-Force Detection</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label class="flex items-center gap-2 mb-4">
                <input type="checkbox" name="bruteForce.enabled" value="true" ${settings.bruteForce.enabled ? 'checked' : ''}
                  class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
                <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Enable brute-force detection</span>
              </label>
            </div>
            <div></div><div></div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Max Failed Attempts per IP</label>
              <input type="number" name="bruteForce.maxFailedAttemptsPerIP" value="${settings.bruteForce.maxFailedAttemptsPerIP}" min="1" max="100"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Max Failed Attempts per Email</label>
              <input type="number" name="bruteForce.maxFailedAttemptsPerEmail" value="${settings.bruteForce.maxFailedAttemptsPerEmail}" min="1" max="100"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Window (minutes)</label>
              <input type="number" name="bruteForce.windowMinutes" value="${settings.bruteForce.windowMinutes}" min="1" max="1440"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Lockout Duration (minutes)</label>
              <input type="number" name="bruteForce.lockoutDurationMinutes" value="${settings.bruteForce.lockoutDurationMinutes}" min="1" max="1440"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Alert Threshold</label>
              <input type="number" name="bruteForce.alertThreshold" value="${settings.bruteForce.alertThreshold}" min="1" max="1000"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
              <p class="mt-1 text-xs text-zinc-400">Events above this count trigger critical severity</p>
            </div>
          </div>
        </div>

        <!-- Event Logging -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <h2 class="text-base font-semibold text-zinc-950 dark:text-white mb-4">Event Logging</h2>
          <div class="space-y-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" name="logging.logSuccessfulLogins" value="true" ${settings.logging.logSuccessfulLogins ? 'checked' : ''}
                class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">Log successful logins</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" name="logging.logLogouts" value="true" ${settings.logging.logLogouts ? 'checked' : ''}
                class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">Log logouts</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" name="logging.logRegistrations" value="true" ${settings.logging.logRegistrations ? 'checked' : ''}
                class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">Log registrations</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" name="logging.logPasswordResets" value="true" ${settings.logging.logPasswordResets ? 'checked' : ''}
                class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">Log password resets</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" name="logging.logPermissionDenied" value="true" ${settings.logging.logPermissionDenied ? 'checked' : ''}
                class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">Log permission denied events</span>
            </label>
          </div>
        </div>

        <!-- Data Retention -->
        <div class="rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 ring-1 ring-zinc-950/5 dark:ring-white/10 shadow-sm">
          <h2 class="text-base font-semibold text-zinc-950 dark:text-white mb-4">Data Retention</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Days to Keep</label>
              <input type="number" name="retention.daysToKeep" value="${settings.retention.daysToKeep}" min="1" max="365"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Max Events</label>
              <input type="number" name="retention.maxEvents" value="${settings.retention.maxEvents}" min="1000" max="1000000"
                class="w-full rounded-lg border-0 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 focus:ring-2 focus:ring-cyan-500">
            </div>
            <div>
              <label class="flex items-center gap-2 mt-5">
                <input type="checkbox" name="retention.autoPurge" value="true" ${settings.retention.autoPurge ? 'checked' : ''}
                  class="rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500">
                <span class="text-sm text-zinc-700 dark:text-zinc-300">Auto-purge old events</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between">
          <button type="button"
            onclick="if(confirm('Purge events older than retention period?')) fetch('/api/security-audit/events/purge', {method:'POST',headers:{'Content-Type':'application/json'}}).then(r=>r.json()).then(d=>window.showNotification && window.showNotification('Purged '+d.deleted+' events','success'))"
            class="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 ring-1 ring-red-200 dark:ring-red-800 transition-colors">
            Purge Old Events
          </button>
          <button type="submit"
            class="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors shadow-sm">
            Save Settings
          </button>
        </div>
      </form>
    </div>
  `

  const layoutData: AdminLayoutCatalystData = {
    title: 'Security Audit Settings',
    pageTitle: 'Security Audit Settings',
    currentPath: '/admin/plugins/security-audit/settings',
    user,
    content,
    version,
    dynamicMenuItems
  }

  return renderAdminLayoutCatalyst(layoutData)
}
