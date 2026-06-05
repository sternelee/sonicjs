import { renderAdminLayoutCatalyst } from '../layouts/admin-layout-catalyst.template'
import { renderAlert } from '../components/alert.template'
import { escapeHtml } from '../../utils/sanitize'
import type { DocumentType } from '../../schemas/document'

export interface DocumentListPageData {
  docType: DocumentType
  items: Array<{
    id: string
    rootId: string
    typeId: string
    title: string | null
    slug: string | null
    status: string
    isCurrentDraft: boolean
    isPublished: boolean
    versionNumber: number
    locale: string
    publishedAt: number | null
    updatedAt: number
    data: Record<string, unknown>
  }>
  filters: {
    status: string
    limit: number
  }
  nextCursor: { cursor_updated_at: number; cursor_id: string } | null
  message?: string
  messageType?: 'success' | 'error' | 'warning' | 'info'
  user?: { name: string; email: string; role: string }
  version?: string
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function statusBadge(item: DocumentListPageData['items'][0]): string {
  if (item.isPublished && item.isCurrentDraft) {
    return `<span class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-500/20">Published</span>`
  }
  if (item.isPublished) {
    return `<span class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-500/20">Published + Draft</span>`
  }
  if (item.status === 'archived') {
    return `<span class="inline-flex items-center rounded-md bg-zinc-50 dark:bg-zinc-500/10 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/20">Archived</span>`
  }
  return `<span class="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/20">Draft</span>`
}

function summaryText(item: DocumentListPageData['items'][0]): string {
  if (item.title) return escapeHtml(item.title)
  const dataKeys = Object.keys(item.data)
  const firstKey = dataKeys[0]
  if (firstKey !== undefined) {
    const firstVal = item.data[firstKey]
    if (typeof firstVal === 'string') return escapeHtml(firstVal.slice(0, 80))
  }
  return `<span class="text-zinc-400 dark:text-zinc-500 italic">Untitled</span>`
}

export function renderDocumentsListPage(data: DocumentListPageData): string {
  const { docType, items, filters, nextCursor } = data
  const isAdmin = data.user?.role === 'admin'

  const filterStatus = filters.status

  const rows = items.map(item => `
    <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
        <div class="text-sm font-medium text-zinc-950 dark:text-white">
          <a href="/admin/documents/ui/${escapeHtml(docType.id)}/${escapeHtml(item.rootId)}/edit"
             class="hover:text-blue-600 dark:hover:text-blue-400">
            ${summaryText(item)}
          </a>
        </div>
        ${item.slug ? `<div class="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">${escapeHtml(item.slug)}</div>` : ''}
      </td>
      <td class="whitespace-nowrap px-3 py-4 text-sm">${statusBadge(item)}</td>
      <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
        v${item.versionNumber}
      </td>
      <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
        ${formatDate(item.updatedAt)}
      </td>
      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/documents/ui/${escapeHtml(docType.id)}/${escapeHtml(item.rootId)}/edit"
             class="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
             title="Edit">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/>
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z"/>
            </svg>
          </a>
          ${!item.isPublished ? `
          <form method="POST" action="/admin/documents/ui/${escapeHtml(docType.id)}/${escapeHtml(item.id)}/publish" style="display:inline">
            <button type="submit"
               class="inline-flex items-center justify-center p-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-500/20 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
               title="Publish">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd"/>
              </svg>
            </button>
          </form>` : `
          <form method="POST" action="/admin/documents/ui/${escapeHtml(docType.id)}/${escapeHtml(item.id)}/unpublish" style="display:inline">
            <button type="submit"
               class="inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
               title="Unpublish">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd"/>
              </svg>
            </button>
          </form>`}
          ${isAdmin ? `
          <form method="POST" action="/admin/documents/ui/${escapeHtml(docType.id)}/${escapeHtml(item.id)}/delete" style="display:inline"
                onsubmit="return confirm('Delete this document? This cannot be undone.')">
            <button type="submit"
               class="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20 dark:ring-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
               title="Delete">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/>
              </svg>
            </button>
          </form>` : ''}
        </div>
      </td>
    </tr>
  `).join('')

  const emptyState = `
    <tr>
      <td colspan="5" class="py-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <svg class="h-12 w-12 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
          </svg>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">No ${escapeHtml(docType.displayName)} documents yet.</p>
          <a href="/admin/documents/ui/${escapeHtml(docType.id)}/new"
             class="inline-flex items-center rounded-lg bg-zinc-950 dark:bg-white px-3 py-1.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
            Create the first one
          </a>
        </div>
      </td>
    </tr>
  `

  const content = `
    <div class="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <a href="/admin/documents/ui" class="hover:text-zinc-950 dark:hover:text-white">Documents</a>
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
            <span class="text-zinc-950 dark:text-white font-medium">${escapeHtml(docType.displayName)}</span>
          </div>
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">
            ${escapeHtml(docType.displayName)}
          </h1>
          ${docType.description ? `<p class="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">${escapeHtml(docType.description)}</p>` : ''}
        </div>
        <div class="mt-4 sm:mt-0">
          <a href="/admin/documents/ui/${escapeHtml(docType.id)}/new"
             class="inline-flex items-center justify-center rounded-lg bg-zinc-950 dark:bg-white px-3.5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
            <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/>
            </svg>
            New ${escapeHtml(docType.displayName)}
          </a>
        </div>
      </div>

      ${data.message ? renderAlert({ type: data.messageType ?? 'info', message: data.message, dismissible: true }) : ''}

      <!-- Filters -->
      <div class="relative rounded-xl">
        <div class="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 dark:from-cyan-400/20 dark:via-blue-400/20 dark:to-purple-400/20 rounded-xl"></div>
        <div class="relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl px-6 py-4">
          <form method="GET" action="/admin/documents/ui/${escapeHtml(docType.id)}" class="flex flex-wrap gap-4 items-end">
            <div>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
              <select name="status"
                class="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-950 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${['all','draft','published'].map(s => `<option value="${s}"${filterStatus === s ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div>
              <button type="submit"
                class="inline-flex items-center rounded-lg bg-zinc-950 dark:bg-white px-3 py-1.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
                Filter
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Table -->
      <div class="relative rounded-xl overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-400/10 dark:to-purple-400/10 rounded-xl"></div>
        <div class="relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl overflow-hidden">
          <table class="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead class="bg-zinc-50/80 dark:bg-zinc-800/50">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:pl-6">Document</th>
                <th scope="col" class="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</th>
                <th scope="col" class="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Version</th>
                <th scope="col" class="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Updated</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
              ${items.length > 0 ? rows : emptyState}
            </tbody>
          </table>

          ${nextCursor ? `
          <div class="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <a href="/admin/documents/ui/${escapeHtml(docType.id)}?status=${filterStatus}&cursor_updated_at=${nextCursor.cursor_updated_at}&cursor_id=${escapeHtml(nextCursor.cursor_id)}"
               class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Load more →
            </a>
          </div>` : ''}
        </div>
      </div>
    </div>
  `

  return renderAdminLayoutCatalyst({
    title: `${docType.displayName} — Documents`,
    currentPath: `/admin/documents/ui/${docType.id}`,
    user: data.user,
    version: data.version,
    content,
  })
}

// ─── Document type selector (landing) ─────────────────────────────────────────

export interface DocumentTypesPageData {
  types: DocumentType[]
  message?: string
  messageType?: 'success' | 'error' | 'warning' | 'info'
  user?: { name: string; email: string; role: string }
  version?: string
}

export function renderDocumentTypesPage(data: DocumentTypesPageData): string {
  const cards = data.types.map(t => `
    <a href="/admin/documents/ui/${escapeHtml(t.id)}"
       class="group relative flex flex-col rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 hover:ring-blue-500/50 dark:hover:ring-blue-400/50 transition-all">
      <div class="mb-3">
        <span class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
          ${escapeHtml(t.source)}
        </span>
      </div>
      <h3 class="text-sm font-semibold text-zinc-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        ${escapeHtml(t.displayName)}
      </h3>
      ${t.description ? `<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">${escapeHtml(t.description)}</p>` : ''}
      <div class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">${t.queryableFields?.length ?? 0} queryable fields</div>
    </a>
  `).join('')

  const content = `
    <div class="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Document Types</h1>
        <p class="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">Select a type to browse and manage its documents.</p>
      </div>

      ${data.message ? renderAlert({ type: data.messageType ?? 'info', message: data.message, dismissible: true }) : ''}

      ${data.types.length === 0
        ? `<div class="text-center py-16 text-sm text-zinc-500 dark:text-zinc-400">No document types registered yet.</div>`
        : `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`
      }
    </div>
  `

  return renderAdminLayoutCatalyst({
    title: 'Document Types — Admin',
    currentPath: '/admin/documents/ui',
    user: data.user,
    version: data.version,
    content,
  })
}
