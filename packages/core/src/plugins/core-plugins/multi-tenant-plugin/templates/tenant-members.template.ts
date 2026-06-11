import { renderAdminLayoutCatalyst } from '../../../../templates/layouts/admin-layout-catalyst.template'
import { escapeHtml } from '../../../../utils/sanitize'
import { VALID_MEMBER_ROLES, type TenantMember } from '../services/tenant-service'

export interface TenantMembersPageData {
  slug: string
  tenantName: string
  members: TenantMember[]
  user?: { name: string; email: string; role: string }
  version?: string
  message?: string
  messageType?: 'success' | 'error'
}

function roleOptions(selected: string): string {
  return VALID_MEMBER_ROLES.map(
    (r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`,
  ).join('')
}

function renderRow(slug: string, m: TenantMember): string {
  const uid = escapeHtml(m.userId)
  return `
    <tr data-member-row="${escapeHtml(m.email)}" class="border-b border-zinc-950/5 dark:border-white/5">
      <td class="px-4 py-3">
        <div class="font-medium text-zinc-950 dark:text-white">${escapeHtml(m.name)}</div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">${escapeHtml(m.email)}</div>
      </td>
      <td class="px-4 py-3">
        <form method="POST" action="/admin/tenants/${escapeHtml(slug)}/members/${uid}/role" class="flex items-center gap-2">
          <select name="role" data-member-role onchange="this.form.requestSubmit ? this.form.requestSubmit() : this.form.submit()"
            class="rounded-lg border border-zinc-950/10 bg-white px-2 py-1.5 text-sm text-zinc-950 dark:border-white/10 dark:bg-zinc-800 dark:text-white">
            ${roleOptions(m.role)}
          </select>
          <noscript><button type="submit" class="text-sm text-cyan-600">Save</button></noscript>
        </form>
      </td>
      <td class="px-4 py-3 text-right">
        <form method="POST" action="/admin/tenants/${escapeHtml(slug)}/members/${uid}/delete" class="inline"
          onsubmit="return confirm('Remove ${escapeHtml(m.email)} from this tenant?')">
          <button type="submit" data-remove-member="${escapeHtml(m.email)}" class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400">Remove</button>
        </form>
      </td>
    </tr>`
}

export function renderTenantMembers(data: TenantMembersPageData): string {
  const alert = data.message
    ? `<div data-members-alert class="mb-6 rounded-lg border px-4 py-3 text-sm ${
        data.messageType === 'error'
          ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      }">${escapeHtml(data.message)}</div>`
    : ''

  const slug = escapeHtml(data.slug)
  const content = `
    <div class="p-6 lg:p-8">
      <div class="mb-2"><a href="/admin/tenants" class="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">← Tenants</a></div>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-zinc-950 dark:text-white">Members — ${escapeHtml(data.tenantName)}</h1>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Users who can access tenant <span class="font-mono">${slug}</span>, and their role within it. The per-tenant role decides what they may do with this tenant's content.</p>
      </div>

      ${alert}

      <div class="mb-6 rounded-xl border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <form method="POST" action="/admin/tenants/${slug}/members" class="flex flex-wrap items-end gap-3" data-add-member-form>
          <div class="flex-1 min-w-[16rem]">
            <label for="member-email" class="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">User email</label>
            <input id="member-email" name="email" type="email" required placeholder="user@example.com"
              class="w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-white/10 dark:bg-zinc-800 dark:text-white">
          </div>
          <div>
            <label for="member-role" class="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Role</label>
            <select id="member-role" name="role"
              class="rounded-lg border border-zinc-950/10 bg-white px-2 py-2 text-sm text-zinc-950 dark:border-white/10 dark:bg-zinc-800 dark:text-white">
              ${roleOptions('viewer')}
            </select>
          </div>
          <button type="submit" data-add-member class="rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">Add member</button>
        </form>
      </div>

      <div class="overflow-hidden rounded-xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-zinc-950/5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-white/5 dark:text-zinc-400">
              <th class="px-4 py-3">User</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.members.map((m) => renderRow(data.slug, m)).join('')}
          </tbody>
        </table>
      </div>
    </div>`

  return renderAdminLayoutCatalyst({
    title: `Members - ${data.tenantName} - SonicJS`,
    pageTitle: 'Tenant Members',
    currentPath: '/admin/tenants',
    user: data.user,
    version: data.version,
    content,
  })
}
